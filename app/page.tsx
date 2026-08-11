export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <a href="/" className="logo">
          NOVERA
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/collection">Collection</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/cart">Cart</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <span className="hero-label">
            NOVERA / FOOTBALL CULTURE
          </span>

          <h1>
            WEAR
            <br />
            THE GAME.
          </h1>

          <p>
            Modern jerseys. Premium streetwear.
            Designed for the next generation.
          </p>

          <a href="/collection" className="hero-button">
            EXPLORE COLLECTION
          </a>
        </div>

        <div className="hero-visual">
          <img
            src="/images/novera-front.png"
            alt="NOVERA football jersey"
          />
        </div>
      </section>

      <section className="launch">
        <span className="launch-label">
          NOVERA / DROP 01
        </span>

        <h2>
          FOOTBALL
          <br />
          BEYOND
          <br />
          THE STADIUM.
        </h2>

        <p>
          Modern football culture, premium design and
          everyday streetwear.
        </p>

        <a href="/collection" className="launch-button">
          EXPLORE COLLECTION
        </a>
      </section>

      <footer>
        <p>© 2026 NOVERA. All rights reserved.</p>
      </footer>
    </main>
  );
}