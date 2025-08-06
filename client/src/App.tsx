import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';
import LoadingSpinner from '@components/LoadingSpinner';
import Layout from '@components/Layout';
import ProtectedRoute from '@components/ProtectedRoute';

// Lazy load pages for better performance
const Dashboard = React.lazy(() => import('@pages/Dashboard'));
const Login = React.lazy(() => import('@pages/auth/Login'));
const Register = React.lazy(() => import('@pages/auth/Register'));
const ForgotPassword = React.lazy(() => import('@pages/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('@pages/auth/ResetPassword'));
const VerifyEmail = React.lazy(() => import('@pages/auth/VerifyEmail'));

// Skills pages
const SkillsDashboard = React.lazy(() => import('@pages/skills/SkillsDashboard'));
const SkillsSearch = React.lazy(() => import('@pages/skills/SkillsSearch'));
const SkillsAssessment = React.lazy(() => import('@pages/skills/SkillsAssessment'));
const LearningPaths = React.lazy(() => import('@pages/skills/LearningPaths'));
const LearningPathDetail = React.lazy(() => import('@pages/skills/LearningPathDetail'));

// Recognition pages
const RecognitionHub = React.lazy(() => import('@pages/recognition/RecognitionHub'));
const GiveRecognition = React.lazy(() => import('@pages/recognition/GiveRecognition'));
const Leaderboard = React.lazy(() => import('@pages/recognition/Leaderboard'));
const Badges = React.lazy(() => import('@pages/recognition/Badges'));

// Interview pages
const InterviewDashboard = React.lazy(() => import('@pages/interview/InterviewDashboard'));
const InterviewSession = React.lazy(() => import('@pages/interview/InterviewSession'));
const InterviewResults = React.lazy(() => import('@pages/interview/InterviewResults'));
const InterviewHistory = React.lazy(() => import('@pages/interview/InterviewHistory'));

// Calendar pages
const Calendar = React.lazy(() => import('@pages/calendar/Calendar'));
const EventDetails = React.lazy(() => import('@pages/calendar/EventDetails'));
const CreateEvent = React.lazy(() => import('@pages/calendar/CreateEvent'));

// Team pages
const TeamSpace = React.lazy(() => import('@pages/team/TeamSpace'));
const TeamAnalytics = React.lazy(() => import('@pages/team/TeamAnalytics'));
const TeamMembers = React.lazy(() => import('@pages/team/TeamMembers'));

// Mentoring pages
const MentoringHub = React.lazy(() => import('@pages/mentoring/MentoringHub'));
const FindMentor = React.lazy(() => import('@pages/mentoring/FindMentor'));
const MentoringSessions = React.lazy(() => import('@pages/mentoring/MentoringSessions'));

// Analytics pages
const Analytics = React.lazy(() => import('@pages/analytics/Analytics'));
const Reports = React.lazy(() => import('@pages/analytics/Reports'));
const Insights = React.lazy(() => import('@pages/analytics/Insights'));

// Profile pages
const Profile = React.lazy(() => import('@pages/profile/Profile'));
const Settings = React.lazy(() => import('@pages/profile/Settings'));
const Preferences = React.lazy(() => import('@pages/profile/Preferences'));

// Admin pages
const AdminDashboard = React.lazy(() => import('@pages/admin/AdminDashboard'));
const UserManagement = React.lazy(() => import('@pages/admin/UserManagement'));
const SystemSettings = React.lazy(() => import('@pages/admin/SystemSettings'));

// Error pages
const NotFound = React.lazy(() => import('@pages/errors/NotFound'));
const Unauthorized = React.lazy(() => import('@pages/errors/Unauthorized'));
const ServerError = React.lazy(() => import('@pages/errors/ServerError'));

function App() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Show loading spinner during initial auth check
  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  return (
    <>
      <Helmet>
        <title>Cognizant Talent & Engagement Hub</title>
        <meta name="description" content="Enterprise talent management and engagement platform" />
        <meta name="theme-color" content="#6366f1" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <AnimatePresence mode="wait">
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <Routes location={location} key={location.pathname}>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
                } 
              />
              <Route 
                path="/register" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
                } 
              />
              <Route 
                path="/forgot-password" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />
                } 
              />
              <Route 
                path="/reset-password" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />
                } 
              />
              <Route 
                path="/verify-email" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <VerifyEmail />
                } 
              />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  {/* Dashboard */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  
                  {/* Skills Routes */}
                  <Route path="/skills" element={<SkillsDashboard />} />
                  <Route path="/skills/search" element={<SkillsSearch />} />
                  <Route path="/skills/assessment" element={<SkillsAssessment />} />
                  <Route path="/skills/learning-paths" element={<LearningPaths />} />
                  <Route path="/skills/learning-paths/:id" element={<LearningPathDetail />} />
                  
                  {/* Recognition Routes */}
                  <Route path="/recognition" element={<RecognitionHub />} />
                  <Route path="/recognition/give" element={<GiveRecognition />} />
                  <Route path="/recognition/leaderboard" element={<Leaderboard />} />
                  <Route path="/recognition/badges" element={<Badges />} />
                  
                  {/* Interview Routes */}
                  <Route path="/interviews" element={<InterviewDashboard />} />
                  <Route path="/interviews/:id" element={<InterviewSession />} />
                  <Route path="/interviews/:id/results" element={<InterviewResults />} />
                  <Route path="/interviews/history" element={<InterviewHistory />} />
                  
                  {/* Calendar Routes */}
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/calendar/events/:id" element={<EventDetails />} />
                  <Route path="/calendar/create" element={<CreateEvent />} />
                  
                  {/* Team Routes */}
                  <Route path="/team" element={<TeamSpace />} />
                  <Route path="/team/analytics" element={<TeamAnalytics />} />
                  <Route path="/team/members" element={<TeamMembers />} />
                  
                  {/* Mentoring Routes */}
                  <Route path="/mentoring" element={<MentoringHub />} />
                  <Route path="/mentoring/find" element={<FindMentor />} />
                  <Route path="/mentoring/sessions" element={<MentoringSessions />} />
                  
                  {/* Analytics Routes */}
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/analytics/reports" element={<Reports />} />
                  <Route path="/analytics/insights" element={<Insights />} />
                  
                  {/* Profile Routes */}
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/settings" element={<Settings />} />
                  <Route path="/profile/preferences" element={<Preferences />} />
                  
                  {/* Admin Routes - Role-based access will be handled in components */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<UserManagement />} />
                  <Route path="/admin/settings" element={<SystemSettings />} />
                </Route>
              </Route>

              {/* Error Routes */}
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/server-error" element={<ServerError />} />
              <Route path="/404" element={<NotFound />} />

              {/* Default redirects */}
              <Route 
                path="/" 
                element={
                  <Navigate 
                    to={isAuthenticated ? "/dashboard" : "/login"} 
                    replace 
                  />
                } 
              />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </div>
    </>
  );
}

export default App;