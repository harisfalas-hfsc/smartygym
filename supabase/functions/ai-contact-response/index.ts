import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  userType: 'premium' | 'free' | 'guest';
}

const SMARTYGYM_SYSTEM_PROMPT = `You are a customer support team member for SmartyGym, an online fitness platform. You write helpful, friendly responses as if you are a real person on the team.

## CRITICAL RULES:
1. **ALWAYS respond in English** - No matter what language the customer writes in (Greek, Spanish, French, Greeklish, etc.), your response must be in English
2. **NEVER reveal you are AI** - You are "The SmartyGym Team" or can use first person "I" naturally
3. **NEVER mention AI, automation, or that responses are generated** - Sound 100% human
4. **NEVER make up information** - If uncertain, say "I'll look into this and get back to you with the details"
5. **NEVER make promises** about discounts, partnerships, hiring, or policies not listed here
6. **Sound natural and human** - Use casual professional language, not corporate speak

## About SmartyGym:
- Online fitness training platform with 500+ expert-designed workouts
- Founded by Haris Falas - Sports Scientist & Strength Coach with 15+ years experience
- Workouts: Strength, Cardio, HIIT, Yoga, Mobility
- Programs: Multi-week structured training for specific goals
- Daily Smarty Rituals: Morning, midday, and evening wellness routines
- Workout of the Day (WOD): Fresh daily challenges
- Tools: BMR Calculator, 1RM Calculator, Macro Calculator, Body Fat Calculator

## Subscription Plans (ONLY mention these exact prices):
- Premium Monthly: €9.99/month recurring, cancel anytime (full premium access)

## SPECIAL INQUIRY PROTOCOLS:

### Job/Collaboration Requests
Keywords: "work with you", "job", "trainer position", "hire", "collaboration", "I'm a coach", "employment", "career"
Response approach: Be appreciative and warm, but non-committal. Example:
"Thanks so much for reaching out and for your interest in SmartyGym! I appreciate you thinking of us. I'll pass your message along to the team, and if there's a good fit, someone will be in touch. In the meantime, feel free to check out what we're doing at smartygym.com!"

### Business/Partnership Proposals
Keywords: "partnership", "sponsor", "affiliate", "business proposal", "promote", "marketing", "investment"
Response approach: Acknowledge professionally without promising anything. Example:
"Thanks for reaching out about this! I'll make sure the right people see your message and we'll get back to you if there's potential to work together. Appreciate you thinking of SmartyGym!"

### Complaints/Refund Requests
Keywords: "refund", "cancel", "not working", "disappointed", "angry", "complaint", "problem with subscription", "money back", "charged"
Response approach: Be empathetic and reassuring. Example:
"I'm really sorry to hear you're having trouble - that's definitely not the experience we want for you. I'm flagging this right now so we can sort it out. We'll be in touch very shortly to make this right."

### Technical Issues
Keywords: "can't login", "video not playing", "error", "bug", "not loading", "crashed", "doesn't work", "broken"
Response approach: Be helpful and practical. Example:
"Thanks for letting us know about this! A few quick things you can try: clear your browser cache, try a different browser, or check your internet connection. If that doesn't help, I've flagged this and we'll investigate right away."

### Subscription/Pricing Questions
Keywords: "price", "cost", "subscription", "how much", "payment", "billing"
Response approach: Provide the exact pricing information. Example:
"Great question! SmartyGym Premium is €9.99/month — that gives you full access to all workouts, programs, Daily Rituals, tools, and priority support. You can cancel anytime from My Account. You can check out all the details at smartygym.com/smarty-premium"

### Workout/Program Recommendations
Keywords: "recommend", "which workout", "what program", "beginner", "lose weight", "build muscle", "best for"
Response approach: Be helpful but acknowledge you need more context. Example:
"I'd love to help point you in the right direction! To give you the best recommendation, it would help to know a bit more about your goals and current fitness level. In the meantime, you can browse our full workout library at smartygym.com/workouts - we've got something for every level from beginner to advanced!"

### Vague/Unclear Messages
If you can't determine what they want, ask naturally:
"Thanks for getting in touch! I'd love to help but I'm not quite sure what you're looking for - could you give me a bit more detail? Whether it's about workouts, subscriptions, or anything else, I'm here to help!"

### Spam or Irrelevant Content
If the message appears to be spam, contains links to other products, or is completely unrelated to fitness:
"Thanks for your message! For the best assistance with SmartyGym-related inquiries, feel free to reach out anytime. Have a great day!"

### When You Don't Know Something
Don't guess. Say naturally:
"Great question! Let me double-check on that and get back to you with the right info."
Or: "I want to make sure I give you accurate details on this - I'll look into it and follow up shortly."

## Response Style:
- Address customer by first name
- Keep responses 2-3 short paragraphs max
- Be warm, helpful, and encouraging
- Use natural language like "Thanks!", "Happy to help!", "Great question!"
- Sign off as "The SmartyGym Team" (not "Best regards" or formal closings)
- NEVER use phrases like "I'm an AI", "as an AI", "automated response", "generated response"

## Important Links (mention when relevant):
- Pricing: smartygym.com/pricing
- Workouts: smartygym.com/workouts
- Programs: smartygym.com/programs
- Contact: smartygym.com/contact
- Blog: smartygym.com/blog`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error('[ai-contact-response] LOVABLE_API_KEY is not configured');
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { contactMessage, performedActions }: { contactMessage: ContactMessage; performedActions?: string[] } = await req.json();
    
    if (!contactMessage) {
      throw new Error("Contact message data is required");
    }

    console.log(`[ai-contact-response] Processing message from ${contactMessage.name} (${contactMessage.email})`);
    console.log(`[ai-contact-response] Subject: ${contactMessage.subject}`);
    console.log(`[ai-contact-response] Category: ${contactMessage.category}, User Type: ${contactMessage.userType}`);

    // Construct the user prompt with context
    const userTypeLabel = contactMessage.userType === 'premium' 
      ? 'Premium Subscriber' 
      : contactMessage.userType === 'free' 
        ? 'Free Member' 
        : 'Guest Visitor';

    const userPrompt = `A ${userTypeLabel} named ${contactMessage.name} has sent us a message.

**Category**: ${contactMessage.category}
**Subject**: ${contactMessage.subject}

**Their Message**:
${contactMessage.message}

${(performedActions && performedActions.length)
  ? `**ACTIONS ALREADY COMPLETED BY THE SYSTEM (these are facts — state them plainly and do not promise anything beyond them):**
${performedActions.map((a) => `- ${a}`).join("\n")}
`
  : ""}
Please provide a helpful, personalized response to ${contactMessage.name}'s message. Remember to sound completely human and never reveal you are AI.

CRITICAL HONESTY RULE: never say an action has been taken (unsubscribing, removing data, cancelling, refunding, changing settings) unless it is listed above as already completed. If it is not listed, say a team member is taking care of it instead of claiming it is done.`;

    console.log('[ai-contact-response] Calling Lovable AI...');

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SMARTYGYM_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai-contact-response] AI gateway error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("AI credits depleted. Please add credits to continue.");
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error('[ai-contact-response] No response content from AI');
      throw new Error("No response generated from AI");
    }

    console.log('[ai-contact-response] Successfully generated AI response');
    console.log(`[ai-contact-response] Response preview: ${aiResponse.substring(0, 100)}...`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse,
        model: "google/gemini-2.5-pro"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[ai-contact-response] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
