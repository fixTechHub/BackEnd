// const mongoose = require('mongoose');
// const Service = require('../models/Service');
// require('dotenv').config();

// const genAI = require('@google/generative-ai');
// const genAIClient = new genAI.GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// async function getGeminiEmbedding(text) {
//   const model = genAIClient.getGenerativeModel({ model: 'gemini-1.5-pro' });
//   const prompt = `Trả về embedding (vector số) cho đoạn văn sau yêu cầu đúng chính xác từ khóa chính từ Tên dịch vụ và mô tả, chỉ trả về mảng số JSON, không giải thích: "${text}"`;
//   const result = await model.generateContent(prompt);
//   let embeddingText = result.response.text().trim();
//   // Loại bỏ mọi code block markdown (``` hoặc ```json)
//   embeddingText = embeddingText.replace(/```json|```/g, '').trim();
//   embeddingText = embeddingText.replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
//   try {
//     const embedding = JSON.parse(embeddingText);
//     return embedding;
//   } catch (err) {
//     console.error('Gemini embeddingText:', embeddingText);
//     throw err;
//   }
// }

// async function generateEmbeddingsForServices() {
//   await mongoose.connect(process.env.MONGO_URI);
//   const services = await Service.find({ $or: [ { embedding: { $exists: false } }, { embedding: { $size: 0 } } ] });
//   let count = 0;
//   for (const service of services) {
//     try {
//       const text = `${service.serviceName || ''} ${service.description || ''}`.trim();
//       if (!text) continue;
//       const embedding = await getGeminiEmbedding(text);
//       // Chỉ update trường embedding, không gọi save() toàn bộ document
//       await Service.updateOne({ _id: service._id }, { $set: { embedding } });
//       count++;
//       console.log(`Updated embedding for service: ${service.serviceName}`);
//     } catch (err) {
//       console.error(`Error for service ${service._id}:`, err.message);
//     }
//   }
//   console.log(`Done. Updated ${count} services.`);
//   await mongoose.disconnect();
// }

// generateEmbeddingsForServices(); 


// const mongoose = require('mongoose');
// const Service = require('../models/Service');
// require('dotenv').config();
// const axios = require('axios');

// const cohereApiKey = process.env.COHERE_API_KEY;

// async function getCohereEmbedding(text) {
//   const response = await axios.post(
//     'https://api.cohere.ai/v1/embed',
//     {
//       texts: [text],
//       model: 'embed-english-v3.0',
//       input_type: 'search_document',
//       embedding_types: ['float']
//     },
//     {
//       headers: {
//         'Authorization': `Bearer ${cohereApiKey}`,
//         'Content-Type': 'application/json',
//       },
//     }
//   );
//   return response.data.embeddings[0];
// }

// async function generateEmbeddingsForServices() {
//   await mongoose.connect(process.env.MONGO_URI);
//   const services = await Service.find({ $or: [ { embedding: { $exists: false } }, { embedding: { $size: 0 } } ] });
//   let count = 0;
//   for (const service of services) {
//     try {
//       const text = `${service.serviceName || ''} ${service.description || ''}`.trim();
//       if (!text) continue;
//       const embedding = await getCohereEmbedding(text);
//       await Service.updateOne({ _id: service._id }, { $set: { embedding } });
//       count++;
//       console.log(`Updated embedding for service: ${service.serviceName}`);
//     } catch (err) {
//       console.error(`Error for service ${service._id}:`, err.message);
//     }
//   }
//   console.log(`Done. Updated ${count} services.`);
//   await mongoose.disconnect();
// }

// generateEmbeddingsForServices();


const mongoose = require('mongoose');
const Service = require('../models/Service');
require('dotenv').config();
const { CohereClient } = require("cohere-ai");

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

async function getCohereEmbedding(text) {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-multilingual-v3.0',
    input_type: 'search_document'
  });
  return response.embeddings[0];
}

async function generateEmbeddingsForServices() {
  await mongoose.connect(process.env.MONGO_URI);
  const services = await Service.find({ $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }] });
  let count = 0;
  for (const service of services) {
    try {
      const text = `${service.serviceName || ''} ${service.description || ''}`.trim();
      if (!text) continue;
      const embedding = await getCohereEmbedding(text);
      await Service.updateOne({ _id: service._id }, { $set: { embedding } });
      count++;
      console.log(`Updated embedding for service: ${service.serviceName}`);
    } catch (err) {
      console.error(`Error for service ${service._id}:`, err.message);
    }
  }
  console.log(`Done. Updated ${count} services.`);
  await mongoose.disconnect();
}

generateEmbeddingsForServices();