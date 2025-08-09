const Service = require("../models/Service");
const cosineSimilarity = require('cosine-similarity');
const { CohereClient } = require("cohere-ai");
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

exports.getPublicServices = async () => {
  return await Service.find({ isActive: true }).sort({ createdAt: -1 });
};

exports.getPublicServicesByCategoryId = async (id) => {
  return await Service.find({ categoryId: id });
};

// exports.suggestServices = async (description) => {
//     const keywords = description.split(' ').filter(word => word.length > 2);
//     const regex = new RegExp(keywords.join('|'), 'i');
//     return await Service.find({
//         $or: [
//             { serviceName: regex },
//             { description: regex }
//         ],
//         isActive: true
//     })
// };

// exports.suggestServices = async (description) => {
//     const inputEmbedding = await getGeminiEmbedding(description);
//     const services = await Service.find({ isActive: true }).lean();
//     const scored = services.map(s => {
//         if (!s.embedding || !Array.isArray(s.embedding) || s.embedding.length === 0) return { ...s, score: -1 };
//         return { ...s, score: cosineSimilarity(inputEmbedding, s.embedding) };
//     });
//     return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
// };

const cohereApiKey = process.env.COHERE_API_KEY;

async function getCohereEmbedding(text) {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-multilingual-v3.0',
    input_type: 'search_query'
  });
  return response.embeddings[0];
}

exports.suggestServices = async (description) => {
  try {
    const inputEmbedding = await getCohereEmbedding(description);
    const services = await Service.find({ isActive: true }).lean();
    const scored = services.map(s => {
      if (!s.embedding || !Array.isArray(s.embedding) || s.embedding.length === 0) return { ...s, score: -1 };
      const score = cosineSimilarity(inputEmbedding, s.embedding);
      return { ...s, score };
    });
    // Nới lỏng điều kiện lọc để debug
    let result = scored.filter(s => s.score > 0.3).sort((a, b) => b.score - a.score).slice(0, 5);
    // Loại bỏ trường embedding khỏi kết quả trả về
    result = result.map(({ embedding, ...rest }) => rest);
    if (result.length === 0) {
      // Fallback: tìm kiếm từ khóa
      const regex = new RegExp(description, 'i');
      result = await Service.find({
        $or: [
          { serviceName: regex },
          { description: regex }
        ],
        isActive: true
      }).limit(5);
      // Loại bỏ embedding nếu có
      result = result.map(({ embedding, ...rest }) => rest);
    }
    return result;
  } catch (err) {
    // Fallback: tìm kiếm từ khóa nếu AI lỗi
    const regex = new RegExp(description, 'i');
    let result = await Service.find({
      $or: [
        { serviceName: regex },
        { description: regex }
      ],
      isActive: true
    }).limit(5);
    // Loại bỏ embedding nếu có
    result = result.map(({ embedding, ...rest }) => rest);
    return result;
  }
};