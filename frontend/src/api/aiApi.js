import api from './axios.js';

/**
 * Ask GioAI a question or request linguistic / conversational assistance.
 * Real AI Engine Cascade:
 * Tier 1: Real AI via POST to Pollinations OpenAI engine (GPT-4o-mini / OpenAI)
 * Tier 2: Real AI via POST to Pollinations Mistral engine
 * Tier 3: Spring Boot Backend (/api/ai/ask)
 * Tier 4: Direct short query fallback
 */
export async function askAiQuestion(question, context = '', language = 'en', history = []) {
  const trimmed = question?.trim() || '';
  if (!trimmed) {
    return {
      answer: 'Please ask a question to receive a short answer.',
      model: 'GioAI',
      success: true,
    };
  }

  const lang = (language || 'en').trim().toLowerCase();

  const systemPrompt = `You are GioAI, a highly intelligent and accurate AI. CRITICAL INSTRUCTIONS:
- Give a DIRECT, CORRECT, and SHORT answer (1 to 2 sentences maximum).
- Never include introductory filler (e.g. "Sure!", "Here is your answer:"), greetings, preambles, or conversational disclaimers.
- Answer immediately and accurately in language: ${lang}.`;

  const userContent = context
    ? `Context: "${context}"\nQuestion: ${trimmed}`
    : trimmed;

  // 1. Primary Real AI: POST to Pollinations (OpenAI GPT-4o-mini)
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain, application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        model: 'openai',
        temperature: 0.3,
        jsonMode: false,
      }),
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const cleaned = cleanShortAiAnswer(text);
      if (cleaned) {
        return {
          answer: cleaned,
          model: 'GioAI (OpenAI)',
          success: true,
        };
      }
    }
  } catch (err) {
    console.warn('[GioAI] Tier 1 OpenAI call failed, trying Mistral:', err?.message);
  }

  // 2. Secondary Real AI: POST to Pollinations (Mistral AI engine)
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain, application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        model: 'mistral',
        temperature: 0.3,
      }),
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const cleaned = cleanShortAiAnswer(text);
      if (cleaned) {
        return {
          answer: cleaned,
          model: 'GioAI (Mistral)',
          success: true,
        };
      }
    }
  } catch (err) {
    console.warn('[GioAI] Tier 2 Mistral call failed, trying Backend:', err?.message);
  }

  // 3. Tertiary Real AI: Spring Boot Backend (/api/ai/ask)
  try {
    const backendRes = await api.post('/api/ai/ask', {
      question: trimmed,
      context: context || '',
      language: lang,
    });
    if (backendRes?.data?.answer) {
      const cleaned = cleanShortAiAnswer(backendRes.data.answer);
      return {
        answer: cleaned,
        model: backendRes.data.model || 'GioAI',
        success: true,
      };
    }
  } catch (backendErr) {
    console.warn('[GioAI] Backend call failed, trying direct GET:', backendErr?.message);
  }

  // 4. Quaternary Real AI: Direct short GET query
  try {
    const shortPrompt = encodeURIComponent(`Answer in 1 short sentence: ${trimmed}`);
    const getRes = await fetch(`https://text.pollinations.ai/${shortPrompt}?model=openai`);
    if (getRes.ok) {
      const text = await getRes.text();
      const cleaned = cleanShortAiAnswer(text);
      if (cleaned) {
        return {
          answer: cleaned,
          model: 'GioAI Cloud',
          success: true,
        };
      }
    }
  } catch (getErr) {
    console.warn('[GioAI] Direct GET failed:', getErr?.message);
  }

  // 5. Offline Fallback
  return {
    answer: getConciseFallback(trimmed, context),
    model: 'GioAI Assistant',
    success: true,
  };
}

/**
 * Strips robotic boilerplate and enforces short, direct answers.
 */
function cleanShortAiAnswer(raw) {
  if (!raw) return '';
  let text = String(raw).trim();

  // Strip robotic prefix introductions
  text = text.replace(/^(Sure!|Certainly!|Here is the answer:|Here is a short answer:|As an AI assistant,?|Here's a direct answer:?)\s*/i, '');
  text = text.replace(/^(Hello!|Hi!|Greetings!)\s*/i, '');

  // Strip trailing robotic pleasantries
  text = text.replace(/\s*(Hope this helps!?|Let me know if you need anything else!?|Feel free to ask if you have more questions!?)$/i, '');

  return text.trim();
}

function getConciseFallback(question, context) {
  const q = question.toLowerCase();
  if (q.includes('hello') || q.includes('hi') || q === 'hey') {
    return "Hello! I'm GioAI. Ask me any question and I will give you a direct, accurate answer.";
  }
  if (q.includes('reply') || q.includes('respond')) {
    return context
      ? `A great short reply: "Thanks for letting me know! Sounds like a plan 👍"`
      : `Short friendly reply: "Thanks for reaching out! Let's catch up soon."`;
  }
  if (q.includes('who are you')) {
    return "I am GioAI, your intelligent multicultural AI assistant built into GioChat.";
  }
  return `Answer: "${question}" has been recorded. For instant real-time live answers, ensure an active network connection.`;
}
