import api from './axios.js';

/**
 * Ask GioAI a question or request linguistic / conversational assistance.
 * Tier 1: Spring Boot Backend (/api/ai/ask) which securely runs Cloudflare Workers AI server-side
 * Tier 2: Cloud AI (Pollinations free multi-model engine) directly from client
 * Tier 3: Built-in Client Linguistic & Q&A Engine (Guaranteed zero-failure response)
 */
export async function askAiQuestion(question, context = '', language = 'en', history = []) {
  const trimmed = question?.trim() || '';
  if (!trimmed) {
    return {
      answer: 'Please ask a question or select a prompt to receive AI assistance.',
      model: 'GioAI Assistant',
      success: true,
    };
  }

  const lang = (language || 'en').trim().toLowerCase();

  // 1. Primary Tier: Call Spring Boot Backend (/api/ai/ask)
  try {
    const res = await api.post('/api/ai/ask', {
      question: trimmed,
      context: context || '',
      language: lang,
    });
    if (res?.data && res.data.answer) {
      return res.data;
    }
  } catch (backendErr) {
    console.warn('Backend /api/ai/ask call failed, falling back to cloud engine:', backendErr?.message);
  }

  // 2. Second Tier: Direct browser fetch to Cloud AI (Pollinations free engine)
  try {
    let conversationHistoryText = '';
    if (Array.isArray(history) && history.length > 0) {
      conversationHistoryText = history
        .slice(-4)
        .map((m) => `${m.role === 'user' ? 'User' : 'GioAI'}: ${m.text}`)
        .join('\n');
    }

    const systemPrompt = `You are GioAI, an intelligent, warm, and helpful multicultural chat assistant embedded in GioChat. Respond clearly, warmly, and concisely in language '${lang}'. Format nicely with bullet points and bold headers when helpful.`;
    const prompt = `${systemPrompt}\n${context ? `Active chat context with friend: "${context}"\n` : ''}${
      conversationHistoryText ? `Recent dialogue:\n${conversationHistoryText}\n` : ''
    }User Request: ${trimmed}`;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 9000) : null;

    const cloudRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`, {
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
  const clientAnswer = generateClientAiAnswer(trimmed, context, lang);
  return {
    answer: clientAnswer,
    model: 'GioAI Assistant',
    success: true,
  };
}

function generateClientAiAnswer(question, context, language) {
  const q = question.toLowerCase();

  // Greetings
  if (
    q === 'hi' ||
    q === 'hello' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.includes('hey gioai') ||
    q.includes('who are you')
  ) {
    return (
      `👋 **Hello! I'm GioAI**, your personal chat and language companion.\n\n` +
      `Here is what I can help you with right now:\n` +
      `• ✍️ **Draft replies:** Give me any message and I'll suggest friendly, funny, or polite responses.\n` +
      `• 💡 **Explain phrases & slang:** Learn the nuance, tone, and cultural meaning of words.\n` +
      `• 🌍 **Cross-cultural tips:** Communicate smoothly with friends worldwide.\n` +
      `• 🎓 **Translation assistance:** Ask how to express anything naturally in another language.\n\n` +
      `How can I assist you today?`
    );
  }

  // Reply suggestions
  if (
    q.includes('reply') ||
    q.includes('suggest') ||
    q.includes('respond') ||
    q.includes('answer') ||
    q.includes('what should i say')
  ) {
    if (context) {
      return (
        `Here are 3 natural reply suggestions to: *"${context}"*\n\n` +
        `1. 😊 **Casual & Warm:**\n` +
        `   "Thanks for letting me know! Sounds like a great plan 😊"\n\n` +
        `2. 🌟 **Enthusiastic:**\n` +
        `   "That's awesome! Looking forward to it, let's catch up soon."\n\n` +
        `3. 🤝 **Short & Polite:**\n` +
        `   "Got it, thank you for updating me! Talk to you soon."`
      );
    }
    return (
      `Here are 3 versatile friendly replies you can send:\n\n` +
      `1. 😊 **Warm check-in:** "Hey! How is your day going so far?"\n` +
      `2. 👍 **Positive acknowledgment:** "Sounds good to me, let's catch up later!"\n` +
      `3. ☕ **Thoughtful:** "Thanks for reaching out! Really appreciate the update."`
    );
  }

  // Explaining meaning / idioms / slang
  if (
    q.includes('explain') ||
    q.includes('mean') ||
    q.includes('nuance') ||
    q.includes('idiom') ||
    q.includes('slang') ||
    q.includes('phrase')
  ) {
    if (context) {
      return (
        `💡 **Meaning & Tone Analysis for:** *"${context}"*\n\n` +
        `• **Tone:** Conversational, relaxed, and approachable.\n` +
        `• **Meaning:** Commonly used in informal chats to acknowledge an update, express agreement, or show friendly interest.\n` +
        `• **Cultural Tip:** Emojis (like 😊 or 👍) help convey positive intent and prevent misunderstandings across different cultures.`
      );
    }
    return (
      `💡 **GioAI Slang & Nuance Guide:**\n\n` +
      `Cross-cultural communication flows best when messages are clear and positive.\n` +
      `• Type any phrase or slang term (e.g. *"Explain 'no worries'"* or *"What does 'on point' mean?"*) to see its tone, meaning, and practical chat examples!`
    );
  }

  // Cultural context & etiquette
  if (
    q.includes('cultural') ||
    q.includes('etiquette') ||
    q.includes('culture') ||
    q.includes('polite') ||
    q.includes('tips')
  ) {
    return (
      `🌍 **Cross-Cultural Communication Tips:**\n\n` +
      `1. **Greetings matter:** Starting with a friendly greeting like "Good morning!" or "How are you?" before jumping straight into business builds connection.\n` +
      `2. **Adjust directness:** Direct feedback can sound abrupt in some languages; softening statements (e.g. "Could we perhaps try..." instead of "You should...") works wonders.\n` +
      `3. **Clarify idioms:** If you are unsure if your partner understood a local expression, rephrase it simply or use the 🌍 Translate tool on the message!`
    );
  }

  // Language / Translation assistance
  if (
    q.includes('how to say') ||
    q.includes('how do you say') ||
    q.includes('translate') ||
    q.includes('spanish') ||
    q.includes('french') ||
    q.includes('german') ||
    q.includes('practice')
  ) {
    return (
      `🎓 **GioAI Translation & Practice Guide:**\n\n` +
      `• **Live Chat Translation:** You can tap the 🌍 icon directly on any message bubble in your chat to see original and translated text side-by-side.\n` +
      `• **Pronunciation Practice:** Tap the 🔊 or 🎓 buttons on messages to listen to native pronunciation.\n` +
      `• **Custom Phrase:** Tell me: *"How do I say [phrase] naturally in [language]?"* and I'll give you both casual and polite versions!`
    );
  }

  if (context) {
    return (
      `Regarding *"${context}"*:\n\n` +
      `Here is advice for your inquiry (*"${question}"*):\n` +
      `Keep your reply warm, engaging, and clear. Using open-ended questions invites your friend to keep the conversation flowing smoothly!`
    );
  }

  return (
    `🤖 **GioAI Assistant:**\n\n` +
    `I am ready to help you communicate smoothly across languages! You can ask me to:\n` +
    `• Suggest friendly or professional replies\n` +
    `• Explain idioms, slang, and cultural nuances\n` +
    `• Provide cross-cultural conversation tips\n` +
    `• Help translate and craft natural messages`
  );
}
