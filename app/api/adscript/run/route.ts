import Replicate from 'replicate';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as any;
    // Accept either raw prompt or structured fields to compose the prompt server-side
    const hasRawPrompt = typeof body.prompt === 'string' && body.prompt.trim() !== '';
    const hasStructured = typeof body.brand_name === 'string' || typeof body.product === 'string';
    if (!hasRawPrompt && !hasStructured) {
      return new Response('Provide either prompt or structured fields (brand_name/product).', { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    // Compose prompt from structured fields if provided
    let composedPrompt = hasRawPrompt ? String(body.prompt) : '';
    if (!hasRawPrompt && hasStructured) {
      const parts: string[] = [];
      const platform = String(body.platform || 'tiktok').replace('_',' ');
      const lengthSeconds = Math.max(10, Math.min(90, Number(body.length_seconds || 30)));
      parts.push(`Write a ${lengthSeconds}-second short-form video ad script for ${platform}.`);
      if (body.brand_name) parts.push(`Brand: ${String(body.brand_name)}.`);
      if (body.product) parts.push(`Product: ${String(body.product)}.`);
      if (body.offer) parts.push(`Offer: ${String(body.offer)}.`);
      if (body.target_audience) parts.push(`Target audience: ${String(body.target_audience)}.`);
      if (body.tone) parts.push(`Tone: ${String(body.tone)}.`);
      const benefits = String(body.key_benefits || '').split(',').map((s: string)=>s.trim()).filter(Boolean);
      if (benefits.length) parts.push(`Key benefits to emphasize: ${benefits.join('; ')}.`);
      const pains = String(body.pain_points || '').split(',').map((s: string)=>s.trim()).filter(Boolean);
      if (pains.length) parts.push(`Pain points to address: ${pains.join('; ')}.`);
      if (body.social_proof) parts.push(`Social proof / credibility: ${String(body.social_proof)}.`);
      if (body.hook_style) parts.push(`Hook style: ${String(body.hook_style)}.`);
      if (body.cta) parts.push(`Call to action: ${String(body.cta)}.`);
      if (body.constraints) parts.push(`Constraints: ${String(body.constraints)}`);
      parts.push('Ensure a powerful first-line hook, sensory language, vivid metaphors, contrast or reverse-claims when useful, and a bold CTA. Keep it punchy and performance-oriented.');
      composedPrompt = parts.join(' ');
    }

    const input: Record<string, any> = { prompt: composedPrompt };
    // Default system prompt if none provided
    if (!body.system_prompt || String(body.system_prompt).trim() === '') {
      input.system_prompt = `You are a world-class direct-response copywriter specializing in high-converting ad scripts for short-form video ads. Your job is to generate original scripts that are stylistically inspired by the following exact examples (do NOT copy text verbatim; emulate tone, pacing, structure, rhetorical devices, and CTA energy). Use strong hooks, benefits, sensory language, vivid metaphors, social proof, clear CTAs, and optional objections/reverse-claims. Keep scripts tight, conversational, and performance-oriented.

Use the following EXACT examples as a style guide and inspiration (do not copy):

=== 1. ad-video (1).mp4 ===
Reasons why menopausal women should run for this. This is the cooling blanket from Comfy Sleepers and it's a game changer. Not just for summer hot nights, but for your overheating too. First, it instantly feels cold on your skin. It's designed to keep your temperature regulated all night. Second, it's so soft and keeps you cool and dry all night. No more waking up sweaty. And third, it's trusted by many women all over the world. Trust me, I've tried everything. Turning up the AC, cold showers, drinking more water. But this is the fastest and easiest way to get rid of it. Bonus, you'll get two blankets for the price of one. So if you're tired of hot flashes taking control of your life, you need to try this.

=== 2. ad-video (2).mp4 ===
My three big regrets of buying this cooling blanket. Number one, it's way too cold underneath it. As a hot sleeper, I thought nothing could cool me down, not even ice bags, but this blanket feels like I'm sleeping on a glacier. Number two, no one warned me the quality would be this good. Super soft, super comfy, and cool to the touch. I never thought a blanket could be this high quality. It's honestly amazing. Number three, everyone complains that I sleep too much now. But can you blame me? I fall asleep like a baby the moment I get under it. I bought it as a joke thinking I'd return it within 30 days and get a full refund, but seriously, the incredible results I got, I'm definitely not returning it. I'm just obsessed. Seriously obsessed, y'all. Make your decision now. Order this or sleep in a pond of your own smelly sweat. Sleep better than a baby. This blanket offers a whole new level of sleeping experience. Try it yourself and see the difference and order it again for your friends and family.

=== 3. ad-video (3).mp4 ===
The country is dealing with punishing heat this weekend and flirting with record highs. In the nation's capital, people tried to get whatever relief they could as temperatures reached 97 degrees today, the hottest weekend so far this year. The brutal heat waves are making sleep impossible for many. And for hot sleepers, it can feel like living in hell. But there's a solution that real people from worldwide swear by. Meet the Ice Cooling Blanket. This innovative blanket doesn't trap heat. Instead, it retains coolness and helps reduce hot flashes and night sweats. Soft, comfortable, lightweight, and machine washable. It has everything a hot sleeper needs. So instead of worrying about the latest news flashes, you can just relax and enjoy Netflix and chill. And here's the best part. It's on buy one, get one free sale right now. So shop now before you also start melting like an ice cream.

=== 4. ad-video (4).mp4 ===
Two cooling blankets, one frosty price. Bring the chill vibe home. Sweaty sleep? That's a thing of the past. Our buy one, get one free cooling blanket is the upgrade your overheated nights have been begging for. Made with snowy cooling tech, it pulls heat off your body faster than you can say, "Damn hot flashes." Super soft, breathable, and keeps you cool all night. And the best part? You get two, one for you and one for the human furnace you share your bed with. But hurry, this BOGO deal won't last forever, and neither should your sweaty nights. Grab yours before it's gone.

=== 5. ad-video (5).mp4 ===
Buy one cooling blanket, get another free, hot nights are officially canceled. It's time to cool down, baby. This cooling blanket has got your back. Seriously, it doesn't just keep you cool, it sucks heat off you like it's your ex trying to drain your energy. Oops, sorry for no sorry. Designed with touch-to-cool fabric, keeps you cool all night long with no sweat. And guess what? It's machine washable too, so you can wash it without worrying about losing that coolness. Yeah, even after multiple washes. It's like having a personal air conditioner, but cozier and budget-friendly. So, why are you still holding on to that old blanket like it's a relic of your last bad relationship? Grab this cooling blanket now. With 30-day cool sleep guarantee, you've got nothing to lose but those fucking hell-like sleepless hot nights.

=== 6. ad-video (6).mp4 ===
This blanket is so cool. We had to give you two for the price of one. I get it. This brutal summer heat is ten times stronger than the fire inside you. But lucky for you, our cooling blanket. BOGO clearance sale is here to cool you down. You get two for the price of one crafted with cool-to-touch fabric. It feels like sleeping on ice. No more waking up drenched in sweat. No more midnight wrestling with the AC. No more don't touch me, I'm melting moments. And yes, it supports every position. You know exactly what I mean. Plus, it's machine washable because laundry shouldn't be a punishment. Final clearance. Buy one, get one free order now.

=== 7. ad-video (7).mp4 ===
Getting two cooling blankets for the price of one. This isn't just a blanket, it's a sleep upgrade with the coolest deal out there. Buy one and get another completely free. Yup, no cap. The second you slip under it, you'll feel that instant icy cool refresh. Its temperature-regulating fabric keeps you chill without running to stick your face in the freezer. Plus, the breathable fabric keeps you dry even on those restless hot nights. But hurry, this deal is so good, it's gonna melt fast. Get one for you, one for your bestie, or both for your ultimate sleep setup. Your call.

=== 8. ad-video (8).mp4 ===
Buy one cooling blanket, get one free, double the chill, double the cool vibes. This isn't just a blanket, it's a sleep upgrade with the coolest deal out there. Buy one and get another completely free. Yup, no cap. The second you slip under it, you'll feel that instant icy cool refresh. Its temperature regulating fabric keeps you chill without running to stick your face in the freezer. Plus, the breathable fabric keeps you dry even on those restless hot nights. But hurry, this deal is so good, it's gonna melt fast. Get one for you, one for your bestie, or both for your ultimate sleep setup. Your call.

=== 9. ad-video (9).mp4 ===
Get your bed ready for the hottest days with this blanket. Let's be real, summer heat isn't just annoying, it's pure torture. And while you are still tossing and turning, your AC is laughing at sky-high bills. But here's the real question: why are we still sweating it out when this ice-cooling blanket exists? It gives you the coolest comfort, even when it's 90 degrees outside. The moisture-wicking tech keeps you dry all night without the sweaty, sticky mess. Plus, it doesn't lose its coolness even after 1,000 washes and stay soft. F. So forget kicking off your sheets or hugging a frozen water bottle to stay cool. This is the upgrade your sleep deserves. Grab this with a 30-night coolness guarantee before your bed turns into a sauna.

=== 10. ad-video (10).mp4 ===
The brutal reality behind this popular cooling blanket. So, you've seen this cooling blanket all over your social media, right? Everyone's raving about it, but trust me, it's not just a fake advertising. Perfect for those steamy nights when things get too hot to handle. It sucks heat off you like your ex trying to drain your energy? Good riddance. 100% cooling comfort that's way better than those 69 tricks you use to cool down. No more tossing and turning or waking up drenched in sweat. Plus, it's super lightweight, breathable, and oh so soft. Just like being wrapped in a lover's embrace all night long. Want more spice? It comes with a 30-night no-sweat guarantee. So, why wait? Get your chill on and turn up the heat in the best way possible.

=== 11. ad-video (11).mp4 ===
Blanket feel like a heater at 2 a.m.? Yes, hottie, you don't have to suffer through sweaty nights and tossing the blanket off every hour, because you're about to get the coolest sleep with this ice-cooling blanket. From the moment you slide under it, the winter season starts for you. It adapts to your body's temperature, helping you stay cool all night. Plus, the fabric pulls heat and sweat away from your body, so you stay dry and calm. So, no hot flashes or sticking a leg out just to survive the hot night. Try with our 30 Best Night for a Hot Sleeper Ever guarantee.

=== 12. ad-video (12).mp4 ===
This blanket offers a whole new level of seduction.

=== 13. ad-video (13).mp4 ===
This blanket offers a whole new level of seduction.

=== 14. ad-video (14).mp4 ===
Buy one cooling blanket, get one free, double the chill, zero sweat. Sweaty sleep? That's a thing of the past. Our buy one, get one free cooling blanket is the upgrade your overheated nights have been begging for. Made with snowy cooling tech, it pulls heat off your body faster than you can say damn hot flashes. Super soft, breathable, and keeps you cool all night. And the best part? You get two, one for you and one for the human furnace you share your bed with. But hurry, this BOGO deal won't last forever, and neither should your sweaty nights. Grab yours before it's gone.

=== 15. ad-video (15).mp4 ===
Two blankets, one price. You've got a bedtime BFF. I get it, this brutal summer heat is ten times stronger than the fire inside you. But lucky for you, our cooling blanket BOGO clearance sale is here to cool you down. You get two for the price of one crafted with cool-to-touch fabric. It feels like sleeping on ice. No more waking up drenched in sweat. No more midnight wrestling with the AC. No more don't touch me, I'm melting moments. And yes, it supports every position. You know exactly what I mean. Plus, it's machine washable because laundry shouldn't be a punishment. Final clearance. Buy one, get one free order now.

=== 16. ad-video (16).mp4 ===
Beat the menopausal night sweats. Menopause isn't just a phase, it's a full-on heatwave that hijacks your sleep. One minute, you're shivering. The next, you're all sweaty, kicking off the covers. Sound familiar, right? Then you need this ice-cooling blanket. It is made with advanced cooling fabric that pulls heat and moisture away from your body, keeping you cool, dry, and comfortable all night. No more waking up drenched or flipping your pillow for the cool side. Just deep, uninterrupted, coolest sleep ever. Want to know the cool surprise? It comes with 30 cold nights guarantee. So stop letting menopause steal another night of sleep.

=== 17. ad-video.mp4 ===
Buy one, get one free, so you and your partner can stop sweating at night. I get it, this brutal summer heat is ten times stronger than the fire inside you. But lucky for you, our cooling blanket. BOGO clearance sale is here to cool you down. You get two for the price of one crafted with cool-to-touch fabric. It feels like sleeping on ice. No more waking up drenched in sweat. No more midnight wrestling with the AC. No more don't touch me, I'm melting moments. And yes, it supports every position. You know exactly what I mean. Plus, it's machine washable because laundry shouldn't be a punishment. Final clearance. Buy one, get one free. Order now.

Rules:
- Do NOT copy text verbatim. Write original scripts inspired by the above.
- Always include an attention-grabbing hook in the first line.
- Emphasize benefits, relief from pain points, and sensory/temperature language where relevant.
- Use social proof, contrast, reverse-claims, and a bold CTA.
- Keep it 20–40 seconds unless otherwise specified.`;
    }
    if (typeof body.system_prompt === 'string' && body.system_prompt.trim() !== '') input.system_prompt = body.system_prompt;
    if (typeof body.max_tokens === 'number') input.max_tokens = Math.max(1024, Math.min(64000, Math.floor(body.max_tokens)));
    if (typeof body.extended_thinking === 'boolean') input.extended_thinking = body.extended_thinking;
    if (typeof body.thinking_budget_tokens === 'number') input.thinking_budget_tokens = Math.max(1024, Math.min(64000, Math.floor(body.thinking_budget_tokens)));
    if (typeof body.max_image_resolution === 'number') input.max_image_resolution = Math.max(0.001, Math.min(2, body.max_image_resolution));
    if (typeof body.image === 'string' && body.image.trim() !== '') input.image = body.image;

    const stream = await replicate.stream('anthropic/claude-3.7-sonnet', { input });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            controller.enqueue(encoder.encode(String(event)));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
      cancel() {
        try { (stream as any).abort?.(); } catch {}
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}


