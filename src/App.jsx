import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/auth/Login';
import Dashboard from './pages/shop/Dashboard';
import Farmers from './pages/shop/Farmers';
import AddTransaction from './pages/shop/AddTransaction';
import UdharList from './pages/shop/UdharList';
import History from './pages/shop/History';
import MonthlyReport from './pages/shop/SeasonReport';
import FarmerProfile from './pages/shop/FarmerProfile';
import Notifications from './pages/shop/Notifications';
import ShopProfile from './pages/shop/Profile';
import Balance from './pages/farmer/Balance';
import MyTransactions from './pages/farmer/MyTransactions';
import FarmerNotifications from './pages/farmer/Notifications';
import FarmerProfileScreen from './pages/farmer/Profile';
import ForgotPassword from './pages/auth/ForgotPassword';
import { FarmerGuard, ShopGuard } from './layouts/AuthGuard';
import ShopLayout from './layouts/ShopLayout';
import FarmerLayout from './layouts/FarmerLayout';
import OfflineBanner from './components/common/OfflineBanner';

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route element={<ShopGuard />}>
          <Route path="/shop" element={<ShopLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="farmers/:farmerId" element={<FarmerProfile />} />
            <Route path="transactions/new" element={<AddTransaction />} />
            <Route path="udhar" element={<UdharList />} />
            <Route path="history" element={<History />} />
            <Route path="report" element={<MonthlyReport />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<ShopProfile />} />
          </Route>
        </Route>
        <Route element={<FarmerGuard />}>
          <Route path="/farmer" element={<FarmerLayout />}>
            <Route index element={<Navigate to="balance" replace />} />
            <Route path="balance" element={<Balance />} />
            <Route path="notifications" element={<FarmerNotifications />} />
            <Route path="transactions" element={<MyTransactions />} />
            <Route path="profile" element={<FarmerProfileScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
