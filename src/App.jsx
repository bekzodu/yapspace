import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home/Home';
import Chat from './pages/Chat/Chat';
import Navbar from './components/Navbar/Navbar';
import VideoChat from './components/VideoChatWrapper/VideoChat';


function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/video" element={<VideoChat />} />
      </Routes>
    </Router>
  );
}

export default App;
