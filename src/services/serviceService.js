const Service = require("../models/Service");
const cosineSimilarity = require('cosine-similarity');
const { CohereClient } = require("cohere-ai");
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

exports.getPublicServices = async () => {
  return await Service.find({ isActive: true })
  .select('-embedding')  
  .sort({ createdAt: -1 });
};

exports.getPublicServicesByCategoryId = async (id) => {
  return await Service.find({ categoryId: id }).select('-embedding');
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
  const stopWords = ['của', 'và', 'hoặc', 'cho', 'với', 'từ', 'đến', 'trong', 'ngoài', 'trên', 'dưới', 'bạn', 'có', 'thể', 'giúp', 'tôi', 'được', 'không', 'nên', 'bị', 'nên', 'nên', 'bạn', 'có', 'thể', 'giúp', 'tôi', 'được', 'không', 'của', 'và', 'hoặc', 'cho', 'với', 'từ', 'đến', 'trong', 'ngoài', 'trên', 'dưới', 'bạn', 'có', 'thể', 'giúp', 'tôi', 'được', 'không', 'nên', 'bị', 'nên', 'nên', 'bạn', 'có', 'thể', 'giúp', 'tôi', 'được', 'không', 'nhà', 'tôi'];
  
  // Tách từ khóa và lọc
  let keywords = normalizedInput
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.includes(word));
  
  // Ưu tiên từ khóa quan trọng nhất (máy lạnh, bẩn, vệ sinh, khóa, etc.)
  const priorityKeywords = ['máy lạnh', 'điều hòa', 'bẩn', 'vệ sinh', 'bảo dưỡng', 'sửa chữa', 'hỏng', 'khóa', 'cửa', 'hư'];
  
  // Sắp xếp lại keywords, ưu tiên từ khóa quan trọng
  keywords = keywords.sort((a, b) => {
    const aPriority = priorityKeywords.indexOf(a);
    const bPriority = priorityKeywords.indexOf(b);
    if (aPriority === -1 && bPriority === -1) return 0;
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    return aPriority - bPriority;
  });
  
  // Chỉ giữ lại từ khóa quan trọng nhất (tối đa 3 từ)
  keywords = keywords.slice(0, 3);
  
  if (keywords.length === 0) return [];
  
  // Tạo từ điển từ khóa liên quan
  const keywordSynonyms = {
    'máy lạnh': ['điều hòa', 'air conditioner', 'ac', 'máy điều hòa', 'điều hòa không khí', 'máy lạnh', 'máy điều hòa nhiệt độ', 'máy lạnh', 'điều hòa'],
    'bẩn': ['vệ sinh', 'làm sạch', 'bảo dưỡng', 'lau chùi', 'tẩy rửa', 'dọn dẹp', 'chùi rửa', 'tẩy uế', 'bẩn', 'dơ', 'ô nhiễm'],
    'hỏng': ['sửa chữa', 'khắc phục', 'sửa lỗi', 'repair', 'fix'],
    'không hoạt động': ['không chạy', 'không bật', 'không khởi động', 'bị trục trặc'],
    'rò rỉ': ['chảy nước', 'dò nước', 'rỉ nước', 'leak'],
    'ồn ào': ['kêu to', 'tiếng ồn', 'rung lắc', 'noise'],
    'tủ lạnh': ['refrigerator', 'fridge', 'tủ đông'],
    'máy giặt': ['washing machine', 'washer'],
    'máy sấy': ['dryer', 'máy sấy quần áo'],
    'bình nóng lạnh': ['water heater', 'bình nước nóng'],
    'lò vi sóng': ['microwave', 'lò vi ba'],
    'bếp': ['stove', 'cooktop', 'bếp gas', 'bếp điện'],
    'quạt': ['fan', 'quạt trần', 'quạt đứng'],
    'đèn': ['light', 'đèn trần', 'đèn tường', 'đèn bàn'],
    'ổ cắm': ['socket', 'power outlet', 'ổ điện'],
    'công tắc': ['switch', 'công tắc đèn', 'công tắc quạt'],
    'dây điện': ['electrical wire', 'cable', 'dây cáp'],
    'ống nước': ['water pipe', 'plumbing', 'đường ống'],
    'vòi nước': ['faucet', 'tap', 'vòi rửa'],
    'bồn cầu': ['toilet', 'wc', 'nhà vệ sinh'],
    'bồn rửa': ['sink', 'bồn rửa mặt', 'chậu rửa'],
    'vòi sen': ['shower', 'vòi tắm'],
    'bồn tắm': ['bathtub', 'bồn tắm'],
    'máy bơm': ['pump', 'máy bơm nước'],
    'máy nước nóng': ['water heater', 'bình nóng lạnh'],
    'máy lọc nước': ['water filter', 'máy lọc'],
    'dàn lạnh': ['dàn trong', 'dàn bay hơi', 'evaporator'],
    'dàn nóng': ['dàn ngoài', 'dàn ngưng tụ', 'condenser'],
    'lọc gió': ['lưới lọc', 'filter', 'bộ lọc không khí'],
    'gas': ['refrigerant', 'môi chất lạnh', 'freon'],
    'ống dẫn gió': ['ống gió', 'duct', 'đường ống gió'],
    'máy hút mùi': ['range hood', 'máy hút khói'],
    'máy lọc không khí': ['air purifier', 'máy lọc khí'],
    'máy hàn': ['welding machine', 'máy hàn điện'],
    'máy nén khí': ['air compressor', 'máy nén'],
    'máy khoan': ['drill', 'máy khoan điện'],
    'máy cắt': ['cutter', 'máy cắt điện'],
    'máy mài': ['grinder', 'máy mài góc'],
    'máy đục': ['hammer drill', 'máy đục bê tông'],
    'máy bào': ['planer', 'máy bào gỗ'],
    'máy cưa': ['saw', 'máy cưa điện'],
    'vệ sinh': ['làm sạch', 'lau chùi', 'tẩy rửa', 'dọn dẹp', 'chùi rửa', 'tẩy uế', 'bảo dưỡng', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh', 'vesinh'],
    'điều hòa': ['máy lạnh', 'air conditioner', 'ac', 'máy điều hòa', 'điều hòa không khí', 'máy điều hòa nhiệt độ'],
    'khóa': ['lock', 'key', 'khóa cửa', 'khóa điện tử', 'khóa vân tay', 'khóa thẻ từ', 'khóa thông minh'],
    'hư': ['hỏng', 'bị hỏng', 'không hoạt động', 'bị trục trặc', 'cần sửa', 'cần thay'],
    'cửa': ['door', 'cửa chính', 'cửa phụ', 'cửa sổ', 'cửa ra vào']
  };
  
  // Mở rộng từ khóa với synonyms
  const expandedKeywords = [...keywords];
  keywords.forEach(keyword => {
    if (keywordSynonyms[keyword]) {
      expandedKeywords.push(...keywordSynonyms[keyword]);
    }
  });
  
  // Tạo regex pattern cho từng từ khóa mở rộng
  const patterns = expandedKeywords.map(keyword => new RegExp(keyword, 'i'));
  
  // Tìm kiếm với độ ưu tiên cao cho tên dịch vụ
  const services = await Service.find({ isActive: true }).lean();
  
  const scored = services.map(service => {
    let score = 0;
    const serviceName = service.serviceName.toLowerCase();
    const serviceDesc = (service.description || '').toLowerCase();
    
    // Điểm cơ bản cho từ khóa chính (quan trọng nhất)
    keywords.forEach(keyword => {
      // Kiểm tra trong tên dịch vụ
      if (serviceName.includes(keyword)) {
        score += 50; // Tăng điểm cho từ khóa chính trong tên
      }
      
      // Kiểm tra trong mô tả
      if (serviceDesc.includes(keyword)) {
        score += 25; // Tăng điểm cho từ khóa chính trong mô tả
      }
    });
    
    // Điểm cho từ khóa mở rộng (synonyms) - giảm điểm để ưu tiên từ khóa chính
    patterns.forEach(pattern => {
      if (pattern.test(serviceName)) {
        score += 5; // Giảm điểm cho synonyms trong tên
      }
      if (pattern.test(serviceDesc)) {
        score += 3; // Giảm điểm cho synonyms trong mô tả
      }
    });
    
    // Bonus đặc biệt cho dịch vụ có cả 2 từ khóa chính
    if (keywords.length >= 2) {
      const hasAllKeywords = keywords.every(keyword => 
        serviceName.includes(keyword) || serviceDesc.includes(keyword)
      );
      if (hasAllKeywords) {
        score += 100; // Tăng bonus rất lớn cho dịch vụ có tất cả từ khóa chính
      }
    }
    
    // Bonus cho tên dịch vụ chứa đầy đủ từ khóa gốc
    if (keywords.every(keyword => serviceName.includes(keyword))) {
      score += 80; // Tăng bonus rất lớn cho tên dịch vụ chứa đầy đủ từ khóa
    }
    
    // Bonus cho tên dịch vụ bắt đầu bằng từ khóa
    if (keywords.some(keyword => serviceName.startsWith(keyword))) {
      score += 40;
    }
    
    // Penalty mạnh hơn cho dịch vụ không liên quan
    if (score === 0) {
      score = -100; // Penalty rất lớn
    }
    
    // Penalty mạnh hơn cho dịch vụ có từ khóa không liên quan
    const irrelevantKeywords = ['máy cầm tay', 'máy hàn', 'máy nén khí', 'máy phát điện', 'máy tính', 'laptop', 'tủ lạnh', 'tủ đông', 'máy giặt', 'máy sấy', 'máy làm đá', 'máy lọc không khí', 'máy hút mùi'];
    if (irrelevantKeywords.some(keyword => serviceName.includes(keyword) || serviceDesc.includes(keyword))) {
      score -= 100; // Giảm điểm mạnh hơn cho dịch vụ không liên quan
    }
    
    // Bonus đặc biệt cho dịch vụ vệ sinh điều hòa/máy lạnh
    if (serviceName.includes('vệ sinh') && (serviceName.includes('điều hòa') || serviceName.includes('máy lạnh') || serviceDesc.includes('điều hòa') || serviceDesc.includes('máy lạnh'))) {
      score += 500; // Bonus cực lớn cho dịch vụ vệ sinh điều hòa
    }
    
    // Bonus cho dịch vụ sửa chữa điều hòa/máy lạnh
    if (serviceName.includes('sửa chữa') && (serviceName.includes('điều hòa') || serviceName.includes('máy lạnh') || serviceDesc.includes('điều hòa') || serviceDesc.includes('máy lạnh'))) {
      score += 300; // Bonus lớn cho dịch vụ sửa chữa điều hòa
    }
    
    // Bonus cho dịch vụ bảo dưỡng điều hòa/máy lạnh
    if (serviceName.includes('bảo dưỡng') && (serviceName.includes('điều hòa') || serviceName.includes('máy lạnh') || serviceDesc.includes('điều hòa') || serviceDesc.includes('máy lạnh'))) {
      score += 250; // Bonus lớn cho dịch vụ bảo dưỡng điều hòa
    }
    
    // Bonus cho dịch vụ liên quan đến khóa cửa
    if (serviceName.includes('khóa') || serviceDesc.includes('khóa')) {
      score += 200; // Bonus lớn cho dịch vụ khóa cửa
    }
    
    // Bonus cho dịch vụ sửa chữa khóa cửa
    if ((serviceName.includes('sửa chữa') || serviceName.includes('sửa')) && (serviceName.includes('khóa') || serviceDesc.includes('khóa'))) {
      score += 300; // Bonus rất lớn cho dịch vụ sửa chữa khóa cửa
    }
    
    // Bonus cho dịch vụ lắp đặt khóa cửa
    if (serviceName.includes('lắp đặt') && (serviceName.includes('khóa') || serviceDesc.includes('khóa'))) {
      score += 250; // Bonus lớn cho dịch vụ lắp đặt khóa cửa
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
    // Chỉ sử dụng AI embedding, không dùng keyword search
    const inputEmbedding = await getCohereEmbedding(description);
    const services = await Service.find({ isActive: true }).lean();
    
    const scored = services.map(s => {
      if (!s.embedding || !Array.isArray(s.embedding) || s.embedding.length === 0) {
        return { ...s, score: -1 };
      }
      const score = cosineSimilarity(inputEmbedding, s.embedding);
      return { ...s, score };
    });
    
    // Lấy kết quả AI với ngưỡng thấp để có nhiều kết quả
    let aiResults = scored
      .filter(s => s.score > 0.3) // Giảm ngưỡng xuống 0.3 để AI tìm được nhiều kết quả hơn
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Tăng số lượng kết quả AI để có nhiều lựa chọn
    
    // Loại bỏ trường embedding
    aiResults = aiResults.map(({ embedding, ...rest }) => rest);
    
    // Chỉ trả về kết quả AI, không kết hợp với keyword search
    return aiResults.slice(0, 5);
    
  } catch (err) {
    console.error('AI embedding error:', err);
    // Fallback: trả về mảng rỗng thay vì dùng keyword search
    return [];
  }
};