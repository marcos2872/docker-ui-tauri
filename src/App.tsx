import "./App.css";
import { Dashboard } from "./components/dashboard";
import { Header } from "./components/header";

function App() {
  return (
    <main className="w-full flex h-screen bg-gray-800 overflow-hidden">
      <Header />
      <section className="w-full">
        <Dashboard />
      </section>
    </main>
  );
}

export default App;
