import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const model = searchParams.get('model');
    if (!model) return new Response('Missing model', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    // Fetch model to get latest version id
    const modelRes = await fetch(`https://api.replicate.com/v1/models/${model}`, {
      headers: { 'Authorization': `Token ${token}` },
      cache: 'no-store',
    });
    if (!modelRes.ok) return new Response(await modelRes.text(), { status: modelRes.status });
    const modelJson = await modelRes.json();
    const versionId = modelJson?.latest_version?.id;
    if (!versionId) return new Response('No latest version found', { status: 500 });

    // Fetch version which contains openapi_schema with Input/Output
    const verRes = await fetch(`https://api.replicate.com/v1/models/${model}/versions/${versionId}`, {
      headers: { 'Authorization': `Token ${token}` },
      cache: 'no-store',
    });
    if (!verRes.ok) return new Response(await verRes.text(), { status: verRes.status });
    const verJson = await verRes.json();
    const schema = verJson?.openapi_schema || verJson?.schema || null;
    if (!schema) return new Response('No schema available', { status: 404 });

    // Try to extract Input schema block
    const inputSchema = schema?.components?.schemas?.Input || null;
    return Response.json({ input: inputSchema, raw: schema });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}


