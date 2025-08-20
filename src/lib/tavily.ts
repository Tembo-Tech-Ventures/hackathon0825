import { fetchWithRetry } from "@/lib/retry";

export interface TavilySearchResultItem {
  title: string;
  url: string;
  content?: string | null;
  score?: number | null;
  favicon?: string | null;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  images?: string[]; // Tavily docs show images as array of URLs
  results: TavilySearchResultItem[];
  auto_parameters?: {
    topic?: string;
    search_depth?: "basic" | "advanced";
  };
  response_time?: string;
}

export interface TavilySearchOptions {
  includeImages?: boolean;
  searchDepth?: "basic" | "advanced";
  includeAnswer?: boolean;
  maxResults?: number;
}

export async function tavilySearch(
  query: string,
  { includeImages = true, searchDepth = "basic", includeAnswer = true, maxResults }: TavilySearchOptions = {}
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY LIB: Missing TAVILY_API_KEY");
    throw new Error("Missing TAVILY_API_KEY");
  }
  const url = "https://api.tavily.com/search";
  const body: Record<string, any> = { query };
  if (includeImages) body.include_images = true;
  if (searchDepth) body.search_depth = searchDepth;
  if (includeAnswer) body.include_answer = true;
  if (typeof maxResults === 'number') body.max_results = maxResults;

  const start = Date.now();
  console.log("TAVILY LIB: START", {
    query,
    includeImages,
    searchDepth,
    includeAnswer,
    maxResults,
    url,
  });
  try {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    console.log("TAVILY LIB: HTTP OK", { status: res.status, ms: Date.now() - start });
    const data = (await res.json()) as TavilySearchResponse;
    console.log("TAVILY LIB: DONE", {
      ms: Date.now() - start,
      results: data?.results?.length || 0,
      images: data?.images?.length || 0,
      auto_parameters: data?.auto_parameters,
      response_time: data?.response_time,
    });
    return data;
  } catch (err: any) {
    console.error("TAVILY LIB: ERROR", {
      ms: Date.now() - start,
      message: err?.message || String(err),
      status: (err as any)?.status,
    });
    throw err;
  }
}
