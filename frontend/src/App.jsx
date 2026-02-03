import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import TestList from './pages/TestList';
import TestDetail from './pages/TestDetail';
import Exam from './pages/Exam';
import ManageLayout from './components/ManageLayout';
import AddPassage from './pages/manage/AddPassage';
import AddSection from './pages/manage/AddSection';
import AddTest from './pages/manage/AddTest';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="tests" element={<TestList />} />
        <Route path="tests/:id" element={<TestDetail />} />
        <Route path="tests/:id/exam" element={<Exam />} />
        <Route path="manage" element={<ManageLayout />}>
          <Route index element={<Navigate to="/manage/passages" replace />} />
          <Route path="passages" element={<AddPassage />} />
          <Route path="passages/:id" element={<AddPassage />} />
          <Route path="sections" element={<AddSection />} />
          <Route path="sections/:id" element={<AddSection />} />
          <Route path="tests" element={<AddTest />} />
          <Route path="tests/:id" element={<AddTest />} />
        </Route>
      </Route>
    </Routes>
  );
}
