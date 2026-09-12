export interface ContentItem {
  slug: string;
  category: string;
  title: string;
  date?: string;
  excerpt?: string;
  body: string;
  featured?: boolean;
  image?: string;
}
