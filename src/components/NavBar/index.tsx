import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export function NavBar() {
  const [screen, setScreen] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      const status: string = await invoke("docker_status");
      setStatus(status);
    })();
  }, []);

  return (
    <div className="flex flex-col justify-between w-32 p-3 h-full bg-gray-900">
      <section className="flex flex-col items-start gap-6">
        <button
          className={`w-full h-8 ${screen == 0 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            setScreen(0);
          }}
        >
          <p className="text-sm text-gray-300">Docker</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 1 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            setScreen(1);
          }}
        >
          <p className="text-sm text-gray-300">Containers</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 2 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            setScreen(2);
          }}
        >
          <p className="text-sm text-gray-300">Images</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 3 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            setScreen(3);
          }}
        >
          <p className="text-sm text-gray-300">Volumes</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 4 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            setScreen(4);
          }}
        >
          <p className="text-sm text-gray-300">Networks</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 5 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            setScreen(5);
          }}
        >
          <p className="text-sm text-gray-300">Servers</p>
        </button>
      </section>
      <div className="w-full flex justify-center">
        <p className="text-[10px] font-semibold text-green-500">{status}</p>
      </div>
    </div>
  );
}
