declare module 'WikipediaTypes' {
  type WikipediaSummary = {
    title: string;
    // Plain-text lead section of the article. CC BY-SA 4.0: wherever it's shown,
    // credit Wikipedia and link the article.
    extract: string;
    url: string;
  };
}
