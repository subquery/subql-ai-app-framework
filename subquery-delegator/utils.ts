export async function grahqlRequest<T = any>(endpoint: string, query: string, variables?: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const res = await response.json();

  // console.log('XXXX raw response', res);

  if (res.errors) {
    console.log(`Request failed\n${query}`)

    throw new Error(res.errors.map((e: any) => e.message).join('\n'));
  }

  return res.data;
}
