import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BUSINESS_NAME } from "../config/business.js";
import "../styles/pages/blogs.css";

const topics = [
  "All",
  "Corporate",
  "Design",
  "Schools",
  "Sports",
  "Crystal",
  "Engraving",
  "Bulk Orders",
];

const articles = [
  {
    title: "How to Choose the Right Award for Every Occasion",
    excerpt: "Match award type, material, engraving and budget to the moment — from employee appreciation to formal annual ceremonies.",
    category: "Corporate",
    date: "May 28, 2024",
    readTime: "6 min read",
    image: "/images/shopping (1).jpg",
    tags: ["Recognition", "HR"],
  },
  {
    title: "The Complete Guide to Trophy Engraving",
    excerpt: "Laser engraving, UV printing and embossing explained in simple terms so your award feels premium and lasts longer.",
    category: "Engraving",
    date: "May 14, 2024",
    readTime: "8 min read",
    image: "/images/plaques.jpg",
    tags: ["Artwork", "Finish"],
  },
  {
    title: "Annual Day Awards: Ideas Beyond the Standard Trophy",
    excerpt: "Creative formats for schools and institutions that make students, faculty and guests remember the ceremony.",
    category: "Schools",
    date: "April 30, 2024",
    readTime: "5 min read",
    image: "/images/memento.jpg",
    tags: ["Academic", "Events"],
  },
  {
    title: "Ordering Medals for a Large Sports Event",
    excerpt: "A practical production timeline for handling 500+ medals without last-minute stress or quality compromises.",
    category: "Sports",
    date: "April 12, 2024",
    readTime: "7 min read",
    image: "/images/shopping.jpg",
    tags: ["Medals", "Timeline"],
  },
  {
    title: "Crystal Awards: What to Know Before You Buy",
    excerpt: "Optical crystal, glass and acrylic can look similar online — here is what actually changes in hand-feel and finish.",
    category: "Crystal",
    date: "March 22, 2024",
    readTime: "7 min read",
    image: "/images/crystal 2.jpg",
    tags: ["Premium", "Materials"],
  },
  {
    title: "How Packaging Changes the Perceived Value of Awards",
    excerpt: "The unboxing moment matters. Choose presentation boxes and inserts that make the recipient feel valued.",
    category: "Design",
    date: "March 8, 2024",
    readTime: "4 min read",
    image: "/images/all.jpg",
    tags: ["Packaging", "Experience"],
  },
];

const featuredArticle = {
  title: "Why Cheap Trophies Cost More in the Long Run",
  excerpt:
    "That low-cost trophy may look acceptable in a photo, but peeling plates, dull finishes and weak bases can quietly damage the experience. Here’s how to judge real value before placing an order.",
  category: "Buying Guide",
  date: "June 2024",
  readTime: "8 min read",
  image: "/images/crystal.jpg",
};

export default function BlogsPage() {
  const [activeTopic, setActiveTopic] = useState("All");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState("");

  useEffect(() => {
    document.title = `Blogs - ${BUSINESS_NAME}`;
  }, []);

  const filteredArticles = useMemo(() => {
    if (activeTopic === "All") return articles;
    if (activeTopic === "Bulk Orders") return articles.filter((article) => article.category === "Corporate");
    return articles.filter((article) => article.category === activeTopic || article.tags.includes(activeTopic));
  }, [activeTopic]);

  const handleNewsletter = (event) => {
    event.preventDefault();
    setNewsletterStatus("Thanks — you’re on the list. We’ll only send useful award planning tips.");
    setNewsletterEmail("");
  };

  return (
    <main className="blogs-page">
      <section className="blogs-hero" aria-labelledby="blogs-title">
        <div className="blogs-hero__copy">
          <span className="blogs-eyebrow">Award insights</span>
          <h1 id="blogs-title">Ideas that make every recognition moment feel intentional.</h1>
          <p>
            Practical guides for choosing trophies, planning award ceremonies, preparing artwork,
            ordering in bulk and creating a premium recipient experience.
          </p>
        </div>
        <div className="blogs-hero__stats" aria-label="Blog highlights">
          <div>
            <strong>25+</strong>
            <span>planning guides</span>
          </div>
          <div>
            <strong>8</strong>
            <span>core topics</span>
          </div>
          <div>
            <strong>1</strong>
            <span>clear buying mindset</span>
          </div>
        </div>
      </section>

      <section className="blog-topics" aria-label="Filter blog topics">
        {topics.map((topic) => (
          <button
            className={topic === activeTopic ? "active" : ""}
            key={topic}
            onClick={() => setActiveTopic(topic)}
            type="button"
          >
            {topic}
          </button>
        ))}
      </section>

      <section className="featured-blog-section" aria-labelledby="featured-blog-title">
        <div className="featured-blog-head">
          <div>
            <span className="blogs-eyebrow">Editor's pick</span>
            <h2 id="featured-blog-title">Start with this featured buying guide</h2>
          </div>
          <p>
            A hand-picked article that helps you avoid common ordering mistakes before you choose
            trophies, materials or engraving options.
          </p>
        </div>

        <div className="featured-blog" aria-label="Featured article">
          <div className="featured-blog__image" style={{ backgroundImage: `url("${featuredArticle.image}")` }}>
            <span>{featuredArticle.category}</span>
          </div>
          <div className="featured-blog__content">
            <span className="blogs-eyebrow">Featured article</span>
            <h2>{featuredArticle.title}</h2>
            <p>{featuredArticle.excerpt}</p>
            <div className="featured-blog__meta">
              <span>{featuredArticle.date}</span>
              <span>{featuredArticle.readTime}</span>
            </div>
            <Link className="blog-read-link" to="/contact">Discuss your requirement</Link>
          </div>
        </div>
      </section>

      <section className="blogs-list-section" aria-labelledby="recent-articles">
        <div className="blogs-section-head">
          <span className="blogs-eyebrow">Recent articles</span>
          <h2 id="recent-articles">Guides for smarter award planning</h2>
          <p>Short, useful reads designed for HR teams, schools, event planners and corporate buyers.</p>
        </div>

        <div className="blogs-grid">
          {filteredArticles.map((article) => (
            <article className="modern-blog-card" key={article.title}>
              <div className="modern-blog-card__image" style={{ backgroundImage: `url("${article.image}")` }}>
                <span>{article.category}</span>
              </div>
              <div className="modern-blog-card__body">
                <div className="modern-blog-card__meta">
                  <span>{article.date}</span>
                  <span>{article.readTime}</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <div className="modern-blog-card__footer">
                  <div>
                    {article.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <Link to="/contact">Ask us</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="blogs-newsletter" aria-label="Newsletter subscription">
        <div>
          <span className="blogs-eyebrow">Monthly note</span>
          <h2>Award planning tips, without the clutter.</h2>
          <p>Get practical ideas for materials, engraving, event timelines and bulk ordering.</p>
        </div>
        <form onSubmit={handleNewsletter}>
          <input
            onChange={(event) => setNewsletterEmail(event.target.value)}
            placeholder="Enter your email"
            required
            type="email"
            value={newsletterEmail}
          />
          <button type="submit">Subscribe</button>
          {newsletterStatus ? <small>{newsletterStatus}</small> : <small>No spam. Just useful planning advice.</small>}
        </form>
      </section>
    </main>
  );
}
