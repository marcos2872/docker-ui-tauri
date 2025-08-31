import "./App.css";
import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { NavBar } from "./components/NavBar";

function App() {
  return (
    <main className="w-full flex flex-col h-screen bg-gray-800 overflow-hidden rounded-lg">
      <Header />
      <section className="w-full h-[calc(100vh-32px)] flex overflow-hidden">
        <NavBar />
        <section className="w-full rounded-br-lg overflow-hidden">
          <Dashboard />
        </section>
      </section>
    </main>
  );
}

export default App;
