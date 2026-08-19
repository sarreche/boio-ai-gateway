const origin = "https://boio-ai-gateway.vercel.app";

export default function Home() {
  return (
    <main>
      <header><span className="eyebrow">INTERNAL API</span><h1>AI Gateway</h1><p>A stable, provider-independent API for chat completions and text embeddings.</p></header>
      <section>
        <h2>Authentication</h2>
        <p>Every <code>/v1/*</code> request requires <code>Authorization: Bearer YOUR_GATEWAY_KEY</code>. The health check is public.</p>
      </section>
      <section>
        <h2>Health</h2><p><code>GET /health</code></p>
        <pre><code>{`curl ${origin}/health`}</code></pre>
      </section>
      <section>
        <h2>Chat completions</h2><p><code>POST /v1/chat/completions</code></p>
        <pre><code>{`curl ${origin}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gateway","messages":[{"role":"user","content":"Hello"}]}'`}</code></pre>
      </section>
      <section>
        <h2>Embeddings</h2><p><code>POST /v1/embeddings</code></p>
        <pre><code>{`curl ${origin}/v1/embeddings \\
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gateway","input":["First text","Second text"]}'`}</code></pre>
      </section>
      <section>
        <h2>JavaScript / TypeScript</h2>
        <pre><code>{`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MY_GATEWAY_API_KEY,
  baseURL: "${origin}/v1"
});

const result = await client.chat.completions.create({
  model: "gateway",
  messages: [{ role: "user", content: "Hello" }]
});`}</code></pre>
      </section>
      <section>
        <h2>Errors</h2>
        <p>Errors use an OpenAI-like <code>error</code> object. Common statuses are <code>400</code> invalid request, <code>401</code> authentication, <code>429</code> rate limit, <code>502</code> provider failure, and <code>504</code> timeout. Every API response includes <code>X-Request-Id</code>.</p>
      </section>
    </main>
  );
}
