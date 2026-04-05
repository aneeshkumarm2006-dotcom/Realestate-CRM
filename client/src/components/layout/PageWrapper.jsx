import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';

/**
 * PageWrapper — standard shell used by all authenticated in-app pages.
 * Renders the Navbar + a max-width page container.
 *
 * See Macan_Design.md Section 8.1.
 *
 * Props:
 *   showNav (bool, default true) — render the Navbar
 *   padded  (bool, default true) — apply 32px 40px page padding
 *   children
 */
const PageWrapper = ({
  showNav = true,
  padded = true,
  children,
  className = '',
}) => {
  // Key the content container on the pathname so the page-transition animation
  // plays on every route change (required by TODO 5.12 and Design Section 9).
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-base">
      {showNav && <Navbar />}

      <div
        className={className}
        style={{
          minHeight: showNav ? 'calc(100vh - 56px)' : '100vh',
          background: 'var(--color-bg-base)',
        }}
      >
        <div
          key={pathname}
          className={[
            'mx-auto w-full macan-page-enter',
            padded ? 'px-4 py-6 md:px-10 md:py-8' : '',
          ].join(' ')}
          style={{
            maxWidth: 1440,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageWrapper;
