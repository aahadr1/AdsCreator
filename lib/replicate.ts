import Replicate from 'replicate';

export function getReplicateClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('Server misconfigured: missing REPLICATE_API_TOKEN');
  return new Replicate({ auth: token });
}


