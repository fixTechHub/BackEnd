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

// Hàm tìm kiếm từ khóa thông minh hơn
async function smartKeywordSearch(description) {
  // Chuẩn hóa input
  const normalizedInput = description.toLowerCase().trim();
  
  // Tách từ khóa và loại bỏ từ không có ý nghĩa
  const stopWords = ['của', 'và', 'hoặc', 'cho', 'với', 'từ', 'đến', 'trong', 'ngoài', 'trên', 'dưới'];
  const keywords = normalizedInput
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.includes(word));
  
  if (keywords.length === 0) return [];
  
  // Tạo regex pattern cho từng từ khóa
  const patterns = keywords.map(keyword => new RegExp(keyword, 'i'));
  
  // Tìm kiếm với độ ưu tiên cao cho tên dịch vụ
  const services = await Service.find({ isActive: true }).lean();
  
  const scored = services.map(service => {
    let score = 0;
    const serviceName = service.serviceName.toLowerCase();
    const serviceDesc = (service.description || '').toLowerCase();
    
    // Điểm cho tên dịch vụ (quan trọng nhất)
    patterns.forEach(pattern => {
      if (pattern.test(serviceName)) {
        score += 10; // Điểm cao cho tên dịch vụ
      }
    });
    
    // Điểm cho mô tả
    patterns.forEach(pattern => {
      if (pattern.test(serviceDesc)) {
        score += 5; // Điểm thấp hơn cho mô tả
      }
    });
    
    // Bonus cho tên dịch vụ chứa đầy đủ từ khóa
    if (keywords.every(keyword => serviceName.includes(keyword))) {
      score += 20; // Bonus lớn cho tên dịch vụ chứa đầy đủ từ khóa
    }
    
    // Bonus cho tên dịch vụ bắt đầu bằng từ khóa
    if (serviceName.startsWith(keywords[0])) {
      score += 15;
    }
    
    return { ...service, score };
  });
  
  // Lọc và sắp xếp kết quả
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ embedding, ...rest }) => rest);
}

exports.suggestServices = async (description) => {
  try {
    // Thử AI embedding trước
    const inputEmbedding = await getCohereEmbedding(description);
    const services = await Service.find({ isActive: true }).lean();
    
    const scored = services.map(s => {
      if (!s.embedding || !Array.isArray(s.embedding) || s.embedding.length === 0) {
        return { ...s, score: -1 };
      }
      const score = cosineSimilarity(inputEmbedding, s.embedding);
      return { ...s, score };
    });
    
    // Tăng ngưỡng similarity để kết quả chính xác hơn
    let result = scored
      .filter(s => s.score > 0.6) // Tăng từ 0.3 lên 0.6
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    // Loại bỏ trường embedding
    result = result.map(({ embedding, ...rest }) => rest);
    
    // Nếu AI không trả về đủ kết quả, sử dụng tìm kiếm từ khóa thông minh
    if (result.length < 3) {
      const keywordResults = await smartKeywordSearch(description);
      
      // Kết hợp kết quả AI và từ khóa, loại bỏ trùng lặp
      const combined = [...result];
      keywordResults.forEach(kr => {
        if (!combined.find(r => r._id.toString() === kr._id.toString())) {
          combined.push(kr);
        }
      });
      
      result = combined.slice(0, 5);
    }
    
    // Nếu vẫn không có kết quả, sử dụng fallback cơ bản
    if (result.length === 0) {
      result = await smartKeywordSearch(description);
    }
    
    return result;
    
  } catch (err) {
    console.error('AI embedding error:', err);
    // Fallback: sử dụng tìm kiếm từ khóa thông minh
    return await smartKeywordSearch(description);
  }
};