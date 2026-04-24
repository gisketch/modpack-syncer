import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeRoute } from "@/routes/home";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomeRoute />
    </QueryClientProvider>
  );
}
