import { createHashRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from '../components/layout/ProtectedRoute';

import LoginPage       from '../pages/Login';
import DashboardPage   from '../pages/Dashboard';
import TablesPage      from '../pages/Tables';
import OrdersPage      from '../pages/Orders';
import OrderDetailPage from '../pages/Orders/OrderDetail';
import NewOrderPage    from '../pages/NewOrder';
import KitchenPage     from '../pages/Kitchen';
import MenuPage        from '../pages/Menu';
import HistoryPage     from '../pages/History';
import FinancePage     from '../pages/Finance';
import UsersPage       from '../pages/Users';
import AnalyticsPage   from '../pages/Analytics';

const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute roles={['admin', 'atendente']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tables',
        element: (
          <ProtectedRoute roles={['admin', 'atendente']}>
            <TablesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute roles={['admin', 'atendente']}>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/new',
        element: (
          <ProtectedRoute roles={['admin', 'atendente']}>
            <NewOrderPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <ProtectedRoute roles={['admin', 'atendente']}>
            <OrderDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kitchen',
        element: (
          <ProtectedRoute roles={['admin', 'cozinha']}>
            <KitchenPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'menu',
        element: (
          <ProtectedRoute roles={['admin']}>
            <MenuPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'history',
        element: (
          <ProtectedRoute roles={['admin', 'atendente']}>
            <HistoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute roles={['admin']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'finance',
        element: (
          <ProtectedRoute roles={['admin']}>
            <FinancePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'analytics',
        element: (
          <ProtectedRoute roles={['admin']}>
            <AnalyticsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
