import { QueryClient } from '@tanstack/react-query';

export function newAccountQueryClient() {
  return new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, e: unknown) => n < 2 && (e as { kind?: string })?.kind === 'network' },
  } });
}

export function detachAccountQueryClient(client: QueryClient) {
  void client.cancelQueries();
  client.clear();
}
