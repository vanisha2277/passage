import PassageApp from './components/PassageApp.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Passage</h1>
        <p className="tagline">Privacy-first immigration document translator</p>
      </header>

      <PassageApp />
    </div>
  );
}
