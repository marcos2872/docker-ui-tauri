import { useState } from "react";
import "./App.css";
import { Dashboard } from "./screens/Dashboard";
import { Header } from "./screens/Header";
import { NavBar } from "./components/NavBar";
import { Containers } from "./screens/Images";
import { Images } from "./screens/Containers";
import { Volumes } from "./screens/Volumes";
import { Networks } from "./screens/Networks";
import { Servers } from "./screens/Servers";

function App() {
  const [screen, setScreen] = useState(0);

  return (
    <main className="w-full flex flex-col h-screen bg-gray-800 overflow-hidden rounded-lg">
      <Header />
      <section className="w-full h-[calc(100vh-32px)] flex overflow-hidden">
        <NavBar changeScreen={setScreen} screen={screen} />
        <section className="w-full rounded-br-lg overflow-hidden">
          {screen === 0 && <Dashboard />}
          {screen === 1 && <Containers />}
          {screen === 2 && <Images />}
          {screen === 3 && <Volumes />}
          {screen === 4 && <Networks />}
          {screen === 5 && <Servers />}
        </section>
      </section>
    </main>
  );
}

export default App;
