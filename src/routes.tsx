import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router';

// Lazy-load every page so the preview only fetches the current page's module
// rather than all 95+ at once (which overwhelmed the dev-server connection limit).
// ProdNotFoundPage stays eager so SSR renderToString never hits a Suspense boundary
// on 404 routes and aborts to client rendering.
import ProdNotFoundPage from './pages/_404';

const HomePage = lazy(() => import('./pages/index'));
const ResourcesPage = lazy(() => import('./pages/resources'));
const MoonCalendarPage = lazy(() => import('./pages/moon-calendar'));
const BirthChartPage = lazy(() => import('./pages/birth-chart'));
const AboutPage = lazy(() => import('./pages/about'));
const HerbsPage = lazy(() => import('./pages/herbs'));
const LoginPage = lazy(() => import('./pages/login'));
const SignupPage = lazy(() => import('./pages/signup'));
const ForgotPasswordPage = lazy(() => import('./pages/forgot-password'));
const AccountPage = lazy(() => import('./pages/account'));
const PrivacySanctuaryPage = lazy(() => import('./pages/account/privacy'));
const ProfileStudioPage = lazy(() => import('./pages/account/profile'));
const EditProfilePage = lazy(() => import('./pages/account/edit-profile'));
const SecurityPage = lazy(() => import('./pages/account/security'));
const AstrologySettingsPage = lazy(() => import('./pages/account/astrology'));
const AccessibilityPage = lazy(() => import('./pages/account/accessibility'));
const AccountTypePage = lazy(() => import('./pages/account/account-type'));
const GrimoirePage = lazy(() => import('./pages/grimoire'));
const TarotPage = lazy(() => import('./pages/tarot'));
const MoonRitualPage = lazy(() => import('./pages/moon-ritual'));
const DashboardPage = lazy(() => import('./pages/dashboard'));
const TimelinePage = lazy(() => import('./pages/timeline'));
const CalendarPage = lazy(() => import('./pages/calendar'));
const DreamJournalPage = lazy(() => import('./pages/dream-journal'));
const SanctuaryPage = lazy(() => import('./pages/sanctuary'));
const SpellsPage = lazy(() => import('./pages/spells/index'));
const SpellDetailPage = lazy(() => import('./pages/spells/[slug]'));
const SubmitSpellPage = lazy(() => import('./pages/spells/submit'));
const AdminDashboardPage = lazy(() => import('./pages/admin/dashboard'));
const AdminApplicationsPage = lazy(() => import('./pages/admin/applications'));
const AdminModeratorPage = lazy(() => import('./pages/admin/moderator'));
const AdminCommunityAdminPage = lazy(() => import('./pages/admin/community-admin'));
const MyApplicationsPage = lazy(() => import('./pages/account/applications'));
const PlusPage = lazy(() => import('./pages/plus'));
const AdminSpellsPage = lazy(() => import('./pages/admin/spells'));
const AdminCommunityPage = lazy(() => import('./pages/admin/community'));
const AdminRolesPage = lazy(() => import('./pages/admin/roles'));
const AdminEngagementPage = lazy(() => import('./pages/admin/engagement'));
const CommandCenterPage = lazy(() => import('./pages/admin/command-center'));
const CreatorApplicationPage = lazy(() => import('./pages/creator-application'));
const CreatorsPage = lazy(() => import('./pages/creators'));
const OrganizationsPage = lazy(() => import('./pages/organizations'));
const CirclesPage = lazy(() => import('./pages/circles'));
const UnsubscribePage = lazy(() => import('./pages/unsubscribe'));
const EmailPreferencesPage = lazy(() => import('./pages/email-preferences'));
const NumerologyPage = lazy(() => import('./pages/numerology'));
const RunesPage = lazy(() => import('./pages/runes'));
const CompatibilityPage = lazy(() => import('./pages/compatibility'));
const ProfilePage = lazy(() => import('./pages/profile/[username]'));
const UserProfilePage = lazy(() => import('./pages/u/[username]'));
const MessagesPage = lazy(() => import('./pages/messages'));
const PrivacyPage = lazy(() => import('./pages/privacy'));
const TermsPage = lazy(() => import('./pages/terms'));
const CommunityPage = lazy(() => import('./pages/community/index'));
const CommunityCategoryPage = lazy(() => import('./pages/community/[slug]'));
const CommunityPostPage = lazy(() => import('./pages/community/post/[id]'));
const CommunityDiscoverPage = lazy(() => import('./pages/community/discover'));
const CommunityNewPage = lazy(() => import('./pages/community/new'));
const CommunityBookmarksPage = lazy(() => import('./pages/community/bookmarks'));
const CommunityNotificationsPage = lazy(() => import('./pages/community/notifications'));
const CommunityHelpGettingStartedPage = lazy(() => import('./pages/community/help/getting-started'));
const CommunityHelpFaqPage = lazy(() => import('./pages/community/help/faq'));
const CommunityHelpGlossaryPage = lazy(() => import('./pages/community/help/glossary'));
const CommunityHelpSafetyPage = lazy(() => import('./pages/community/help/safety'));
const CommunityHelpReportBugPage = lazy(() => import('./pages/community/help/report-a-bug'));
const CommunityAnnouncementsPage = lazy(() => import('./pages/community/announcements'));
const CommunitySuggestionsPage = lazy(() => import('./pages/community/suggestions'));
const AstronomicalAccuracyPage = lazy(() => import('./pages/astronomical-accuracy'));
const TarotCardDetailPage = lazy(() => import('./pages/tarot/cards/[slug]'));
const MoonPhasesPage = lazy(() => import('./pages/moon/phases'));
const MoonEventPage = lazy(() => import('./pages/moon/[type]/[year]/[month]'));
const AstrologyIndexPage = lazy(() => import('./pages/astrology/index'));
const ZodiacSignPage = lazy(() => import('./pages/astrology/[sign]'));
const PlanetsPage = lazy(() => import('./pages/astrology/planets'));
const HousesPage = lazy(() => import('./pages/astrology/houses'));
const AspectsPage = lazy(() => import('./pages/astrology/aspects'));
const LiveSkyPage = lazy(() => import('./pages/astrology/live-sky'));
const CosmicConnectionsPage = lazy(() => import('./pages/astrology/cosmic-connections'));
const CelestialTimeMachinePage = lazy(() => import('./pages/astrology/celestial-time-machine'));
const RemindersPage = lazy(() => import('./pages/reminders'));
const AppStoreSubmissionPage = lazy(() => import('./pages/app-store-submission'));
const AppStoreScreenshotsPage = lazy(() => import('./pages/app-store-screenshots'));
const AppLaunchKitPage = lazy(() => import('./pages/app-launch-kit'));
const HoroscopePage = lazy(() => import('./pages/horoscope'));
const LearnPage = lazy(() => import('./pages/learn/index'));
const AcademyTopicPage = lazy(() => import('./pages/learn/[topicSlug]/index'));
const AcademyLessonPage = lazy(() => import('./pages/learn/[topicSlug]/[lessonSlug]'));
const HowToReadYourBirthChartPage = lazy(() => import('./pages/seo-guides/how-to-read-your-birth-chart'));
const SunMoonRisingSignsPage = lazy(() => import('./pages/seo-guides/sun-moon-rising-signs-explained'));
const TwelveAstrologicalHousesPage = lazy(() => import('./pages/seo-guides/twelve-astrological-houses'));
const MoonSignMeaningPage = lazy(() => import('./pages/seo-guides/moon-sign-meaning'));
const HowToReadTarotPage = lazy(() => import('./pages/seo-guides/how-to-read-tarot-for-beginners'));
const ThreeCardTarotSpreadsPage = lazy(() => import('./pages/seo-guides/three-card-tarot-spreads'));
const MajorVsMinorArcanaPage = lazy(() => import('./pages/seo-guides/major-vs-minor-arcana'));
const EightMoonPhasesPage = lazy(() => import('./pages/seo-guides/eight-moon-phases-meaning'));
const NewMoonVsFullMoonPage = lazy(() => import('./pages/seo-guides/new-moon-vs-full-moon-rituals'));
const HowToUseMoonCalendarPage = lazy(() => import('./pages/seo-guides/how-to-use-a-moon-calendar'));
const WitchcraftForBeginnersPage = lazy(() => import('./pages/seo-guides/witchcraft-for-beginners'));
const HowToCreateGrimoirePage = lazy(() => import('./pages/seo-guides/how-to-create-a-grimoire'));
// TarotSharePage has a named loader export — use a module-level lazy wrapper
const TarotSharePage = lazy(() => import('./pages/tarot/share/[publicId]'));
const ExploreTopic = lazy(() => import('./pages/explore/topic'));
const CommunitySearchPage = lazy(() => import('./pages/community/search'));
const ExplorePage = lazy(() => import('./pages/explore/index'));

// Loader for tarot share page — dynamically imports the module to get the named loader export
const tarotShareLoader: RouteObject['loader'] = async (args) => {
  const mod = await import('./pages/tarot/share/[publicId]');
  return mod.loader!(args);
};

const NotFoundPage = ProdNotFoundPage;

// Suspense wrapper for lazy pages — provides a loading state while the chunk loads
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>{children}</Suspense>;
}

export const routes: RouteObject[] = [
  { path: '/explore/topics/:topic', element: <Lazy><ExploreTopic /></Lazy> },
  {
    path: '/login',
    element: <Lazy><LoginPage /></Lazy>,
  },
  {
    path: '/signup',
    element: <Lazy><SignupPage /></Lazy>,
  },
  {
    path: '/forgot-password',
    element: <Lazy><ForgotPasswordPage /></Lazy>,
  },
  {
    path: '/account',
    element: <Lazy><AccountPage /></Lazy>,
  },
  {
    path: '/account/profile',
    element: <Lazy><ProfileStudioPage /></Lazy>,
  },
  {
    path: '/account/privacy',
    element: <Lazy><PrivacySanctuaryPage /></Lazy>,
  },
  {
    path: '/account/edit-profile',
    element: <Lazy><EditProfilePage /></Lazy>,
  },
  {
    path: '/account/security',
    element: <Lazy><SecurityPage /></Lazy>,
  },
  {
    path: '/account/astrology',
    element: <Lazy><AstrologySettingsPage /></Lazy>,
  },
  {
    path: '/account/accessibility',
    element: <Lazy><AccessibilityPage /></Lazy>,
  },
  {
    path: '/account/account-type',
    element: <Lazy><AccountTypePage /></Lazy>,
  },
  {
    path: '/sanctuary',
    element: <Lazy><SanctuaryPage /></Lazy>,
  },
  {
    path: '/spells',
    element: <Lazy><SpellsPage /></Lazy>,
  },
  {
    path: '/spells/submit',
    element: <Lazy><SubmitSpellPage /></Lazy>,
  },
  {
    path: '/spells/:slug',
    element: <Lazy><SpellDetailPage /></Lazy>,
  },
  {
    path: '/admin/dashboard',
    element: <Lazy><AdminDashboardPage /></Lazy>,
  },
  {
    path: '/admin/applications',
    element: <Lazy><AdminApplicationsPage /></Lazy>,
  },
  {
    path: '/admin/moderator',
    element: <Lazy><AdminModeratorPage /></Lazy>,
  },
  {
    path: '/admin/community-admin',
    element: <Lazy><AdminCommunityAdminPage /></Lazy>,
  },
  {
    path: '/account/applications',
    element: <Lazy><MyApplicationsPage /></Lazy>,
  },
  {
    path: '/plus',
    element: <Lazy><PlusPage /></Lazy>,
  },
  {
    path: '/admin/spells',
    element: <Lazy><AdminSpellsPage /></Lazy>,
  },
  {
    path: '/admin/community',
    element: <Lazy><AdminCommunityPage /></Lazy>,
  },
  {
    path: '/admin/roles',
    element: <Lazy><AdminRolesPage /></Lazy>,
  },
  {
    path: '/admin/engagement',
    element: <Lazy><AdminEngagementPage /></Lazy>,
  },
  {
    path: '/admin/command-center',
    element: <Lazy><CommandCenterPage /></Lazy>,
  },
  {
    path: '/creator-application',
    element: <Lazy><CreatorApplicationPage /></Lazy>,
  },
  {
    path: '/grimoire',
    element: <Lazy><GrimoirePage /></Lazy>,
  },
  {
    path: '/explore',
    element: <Lazy><ExplorePage /></Lazy>,
  },
  {
    path: '/tarot',
    element: <Lazy><TarotPage /></Lazy>,
  },
  {
    path: '/moon-ritual',
    element: <Lazy><MoonRitualPage /></Lazy>,
  },
  {
    path: '/dashboard',
    element: <Lazy><DashboardPage /></Lazy>,
  },
  {
    path: '/timeline',
    element: <Lazy><TimelinePage /></Lazy>,
  },
  {
    path: '/calendar',
    element: <Lazy><CalendarPage /></Lazy>,
  },
  {
    path: '/dream-journal',
    element: <Lazy><DreamJournalPage /></Lazy>,
  },
  {
    path: '/resources',
    element: <Lazy><ResourcesPage /></Lazy>,
  },
  {
    path: '/moon-calendar',
    element: <Lazy><MoonCalendarPage /></Lazy>,
  },
  {
    path: '/birth-chart',
    element: <Lazy><BirthChartPage /></Lazy>,
  },
  {
    path: '/about',
    element: <Lazy><AboutPage /></Lazy>,
  },
  {
    path: '/herbs',
    element: <Lazy><HerbsPage /></Lazy>,
  },
  {
    path: '/',
    element: <Lazy><HomePage /></Lazy>,
  },
  { path: '/numerology', element: <Lazy><NumerologyPage /></Lazy> },
  { path: '/runes', element: <Lazy><RunesPage /></Lazy> },
  { path: '/compatibility', element: <Lazy><CompatibilityPage /></Lazy> },
  { path: '/profile/:username', element: <Lazy><ProfilePage /></Lazy> },
  {
    path: '/u/:username',
    element: <Lazy><UserProfilePage /></Lazy>,
    loader: async ({ params }: { params: Record<string, string | undefined> }) => {
      try {
        // Fetch minimal profile data server-side so SSR HTML includes correct OG meta.
        // Uses an absolute URL on the server; relative on the client (both work).
        const base = typeof window === 'undefined' ? 'http://localhost:3000' : '';
        const res = await fetch(`${base}/api/profile/${encodeURIComponent(params.username ?? '')}`);
        if (!res.ok) return { seoProfile: null };
        const data = await res.json() as { profile?: { name?: string | null; username?: string | null; bio?: string | null } };
        return { seoProfile: data.profile ?? null };
      } catch {
        return { seoProfile: null };
      }
    },
  },
  { path: '/messages', element: <Lazy><MessagesPage /></Lazy> },
  { path: '/privacy', element: <Lazy><PrivacyPage /></Lazy> },
  { path: '/terms', element: <Lazy><TermsPage /></Lazy> },
  { path: '/community', element: <Lazy><CommunityPage /></Lazy> },
  // Static community paths MUST come before /community/:slug so React Router
  // does not match "new", "bookmarks", "notifications", "post", or "discover"
  // as a :slug param and render the wrong page.
  { path: '/community/new', element: <Lazy><CommunityNewPage /></Lazy> },
  { path: '/community/bookmarks', element: <Lazy><CommunityBookmarksPage /></Lazy> },
  { path: '/community/notifications', element: <Lazy><CommunityNotificationsPage /></Lazy> },
  { path: '/community/discover', element: <Lazy><CommunityDiscoverPage /></Lazy> },
  { path: '/community/search', element: <Lazy><CommunitySearchPage /></Lazy> },
  { path: '/community/post/:id', element: <Lazy><CommunityPostPage /></Lazy>,
    loader: async ({ params }) => {
      try {
        const base = typeof window === 'undefined' ? 'http://localhost:3000' : '';
        const response = await fetch(base + '/api/community/posts/' + encodeURIComponent(params.id ?? '') + '/reading-preview');
        if (response.ok) return { readingPreview: await response.json() };
      } catch { /* Keep the standard preview. */ }
      return { readingPreview: null };
    },
  },
  { path: '/community/help/getting-started', element: <Lazy><CommunityHelpGettingStartedPage /></Lazy> },
  { path: '/community/help/faq', element: <Lazy><CommunityHelpFaqPage /></Lazy> },
  { path: '/community/help/glossary', element: <Lazy><CommunityHelpGlossaryPage /></Lazy> },
  { path: '/community/help/safety', element: <Lazy><CommunityHelpSafetyPage /></Lazy> },
  { path: '/community/help/report-a-bug', element: <Lazy><CommunityHelpReportBugPage /></Lazy> },
  { path: '/community/announcements', element: <Lazy><CommunityAnnouncementsPage /></Lazy> },
  { path: '/community/suggestions', element: <Lazy><CommunitySuggestionsPage /></Lazy> },
  { path: '/community/:slug', element: <Lazy><CommunityCategoryPage /></Lazy> },
  { path: '/creators', element: <Lazy><CreatorsPage /></Lazy> },
  { path: '/organizations', element: <Lazy><OrganizationsPage /></Lazy> },
  { path: '/circles', element: <Lazy><CirclesPage /></Lazy> },
  { path: '/astronomical-accuracy', element: <Lazy><AstronomicalAccuracyPage /></Lazy> },
  { path: '/tarot/cards/:slug', element: <Lazy><TarotCardDetailPage /></Lazy> },
  { path: '/tarot/share/:publicId', element: <Lazy><TarotSharePage /></Lazy>, loader: tarotShareLoader },
  { path: '/moon/phases', element: <Lazy><MoonPhasesPage /></Lazy> },
  { path: '/moon/:type/:year/:month', element: <Lazy><MoonEventPage /></Lazy> },
  { path: '/astrology', element: <Lazy><AstrologyIndexPage /></Lazy> },
  { path: '/astrology/planets', element: <Lazy><PlanetsPage /></Lazy> },
  { path: '/astrology/houses', element: <Lazy><HousesPage /></Lazy> },
  { path: '/astrology/aspects', element: <Lazy><AspectsPage /></Lazy> },
  { path: '/astrology/live-sky', element: <Lazy><LiveSkyPage /></Lazy> },
  { path: '/astrology/cosmic-connections', element: <Lazy><CosmicConnectionsPage /></Lazy> },
  { path: '/astrology/celestial-time-machine', element: <Lazy><CelestialTimeMachinePage /></Lazy> },
  { path: '/astrology/:sign', element: <Lazy><ZodiacSignPage /></Lazy> },
  { path: '/reminders', element: <Lazy><RemindersPage /></Lazy> },
  { path: '/app-store-submission', element: <Lazy><AppStoreSubmissionPage /></Lazy> },
  { path: '/app-store-screenshots', element: <Lazy><AppStoreScreenshotsPage /></Lazy> },
  { path: '/app-launch-kit', element: <Lazy><AppLaunchKitPage /></Lazy> },
  { path: '/horoscope', element: <Lazy><HoroscopePage /></Lazy> },
  { path: '/learn', element: <Lazy><LearnPage /></Lazy> },
  { path: '/learn/:topicSlug', element: <Lazy><AcademyTopicPage /></Lazy> },
  { path: '/learn/:topicSlug/:lessonSlug', element: <Lazy><AcademyLessonPage /></Lazy> },
  { path: '/seo-guides/how-to-read-your-birth-chart', element: <Lazy><HowToReadYourBirthChartPage /></Lazy> },
  { path: '/seo-guides/sun-moon-rising-signs-explained', element: <Lazy><SunMoonRisingSignsPage /></Lazy> },
  { path: '/seo-guides/twelve-astrological-houses', element: <Lazy><TwelveAstrologicalHousesPage /></Lazy> },
  { path: '/seo-guides/moon-sign-meaning', element: <Lazy><MoonSignMeaningPage /></Lazy> },
  { path: '/seo-guides/how-to-read-tarot-for-beginners', element: <Lazy><HowToReadTarotPage /></Lazy> },
  { path: '/seo-guides/three-card-tarot-spreads', element: <Lazy><ThreeCardTarotSpreadsPage /></Lazy> },
  { path: '/seo-guides/major-vs-minor-arcana', element: <Lazy><MajorVsMinorArcanaPage /></Lazy> },
  { path: '/seo-guides/eight-moon-phases-meaning', element: <Lazy><EightMoonPhasesPage /></Lazy> },
  { path: '/seo-guides/new-moon-vs-full-moon-rituals', element: <Lazy><NewMoonVsFullMoonPage /></Lazy> },
  { path: '/seo-guides/how-to-use-a-moon-calendar', element: <Lazy><HowToUseMoonCalendarPage /></Lazy> },
  { path: '/seo-guides/witchcraft-for-beginners', element: <Lazy><WitchcraftForBeginnersPage /></Lazy> },
  { path: '/seo-guides/how-to-create-a-grimoire', element: <Lazy><HowToCreateGrimoirePage /></Lazy> },
  { path: '/unsubscribe', element: <Lazy><UnsubscribePage /></Lazy> },
  { path: '/email-preferences', element: <Lazy><EmailPreferencesPage /></Lazy> },
  {
    id: 'airo-not-found',
    path: '*',
    element: <NotFoundPage />,
  },
];

// Types for type-safe navigation
export type Path = '/' | '/birth-chart';

export type Params = Record<string, string | undefined>;
