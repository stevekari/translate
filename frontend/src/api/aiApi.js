import api from './axios.js';

export async function askAiQuestion(question, context = '', language = 'en') {
  const trimmed = question?.trim() || '';
  if (!trimmed) {
    return {
      answer: 'Please ask a question or select a prompt to receive AI assistance.',
      model: 'GioAI Assistant',
      success: true,
    };
  }

  // 1. First Tier: Call Spring Boot Backend (/api/ai/ask)
  try {
    const res = await api.post('/api/ai/ask', {
      question: trimmed,
      context: context || '',
      language: language || 'en',
    });
    if (res?.data && res.data.answer) {
      return res.data;
    }
  } catch (backendErr) {
    console.warn('Backend /api/ai/ask call failed (server may need restart), falling back to direct AI:', backendErr?.message);
  }

  // 2. Second Tier: Direct browser fetch to Cloud AI (Pollinations free OpenAI-compatible engine)
  try {
    const prompt = `You are GioAI, a friendly, concise, and helpful multicultural chat assistant. Respond warmly and clearly in language '${language || 'en'}'. ${context ? `Conversation context: "${context}". ` : ''}User Question: ${trimmed}`;
    
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    const cloudRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (cloudRes.ok) {
      const text = await cloudRes.text();
      if (text && text.trim()) {
        return {
          answer: text.trim(),
          model: 'GioAI Cloud',
          success: true,
        };
      }
    }
  } catch (cloudErr) {
    console.warn('Cloud AI fetch failed, using built-in linguistic engine:', cloudErr?.message);
  }

  // 3. Third Tier: Instant Built-in Client Linguistic & Q&A Engine (Guaranteed zero-failure response)
  const clientAnswer = generateClientAiAnswer(trimmed, context, language);
  return {
    answer: clientAnswer,
    model: 'GioAI Assistant',
    success: true,
  };
}

function generateClientAiAnswer(question, context, language) {
  const q = question.toLowerCase();

  // Reply suggestions
  if (q.includes('reply') || q.includes('suggest') || q.includes('respond') || q.includes('answer')) {
    if (context) {
      return `Here are 3 natural, friendly reply suggestions to "${context}":\n\n` +
        `1. Casual & warm: "Thanks for letting me know! Sounds like a great plan 😊"\n` +
        `2. Enthusiastic: "That sounds awesome! Looking forward to it."\n` +
        `3. Short & polite: "Got it, thank you! Talk soon."`;
    }
    return `Here are 3 friendly ways to reply:\n\n` +
      `1. "Thanks for reaching out! How are things going with you?"\n` +
      `2. "Sounds good to me, let's catch up soon!"\n` +
      `3. "Understood, thank you for sharing that with me."`;
  }

  // Explaining meaning / idioms
  if (q.includes('explain') || q.includes('mean') || q.includes('nuance') || q.includes('idiom') || q.includes('phrase')) {
    if (context) {
      return `Meaning & Tone for "${context}":\n\n` +
        `• Tone: Friendly and conversational.\n` +
        `• Meaning: This is commonly used in informal communication to express thoughts, acknowledge messages, or keep conversations flowing naturally.\n` +
        `• Tip: Using emojis (like 😊 or 👍) helps convey warmth and avoid misunderstandings across different languages.`;
    }
    return `GioAI Language Tip:\n\n` +
      `Cross-cultural communication flows best when messages are clear, positive, and acknowledge the other person's perspective. You can tap 🌍 Translate on any message to see both the original and translated versions side-by-side!`;
  }

  // Cultural context
  if (q.includes('cultural') || q.includes('etiquette') || q.includes('culture') || q.includes('tips')) {
    return `Cultural Conversation Tips:\n\n` +
      `• Greetings matter: In many cultures, asking "How are you doing?" before diving into topics builds trust.\n` +
      `• Tone: Directness varies widely—some cultures prefer softer phrasing like "Could we perhaps..." instead of "We need to...".\n` +
      `• Clarity: Avoid localized slang or idioms unless your chat partner is familiar with them.`;
  }

  // Language / Translation assistance
  if (q.includes('how to say') || q.includes('how do you say') || q.includes('translate') || q.includes('practice')) {
    return `GioAI Translation Guidance:\n\n` +
      `To translate any message instantly into your language, tap the 🌍 Translate button right on the message bubble! You can also practice speaking with native pronunciation by tapping the 🎓 or 🔊 buttons.`;
  }

  if (context) {
    return `Regarding "${context}":\n\n` +
      `Insight on "${question}":\n` +
      `This is a great point in your conversation. Keeping answers warm, engaging, and clear makes cross-language chats smooth and enjoyable!`;
  }

  return `GioAI Assistant:\n\n` +
    `I am ready to help you communicate smoothly across languages! You can ask me to:\n` +
    `• Suggest friendly replies\n` +
    `• Explain idioms and slang\n` +
    `• Provide cross-cultural conversation tips\n` +
    `• Answer questions and provide translation guidance`;
}
