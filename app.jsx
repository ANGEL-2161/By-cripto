// app.jsx — Vértice Exchange OS · Main app
const { useState: useAS, useEffect: useAE, useMemo: useAM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tema": "oscuro",
  "paleta": "mineral",
  "tipografia": "tecnico",
  "grafico": "velas",
  "densidad": "normal"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useAS(() => {
    const h = (location.hash || "").replace(/^#/, "");
    return ["trading", "mercados", "wallet", "factory", "blockchain", "admin"].includes(h) ? h : "trading";
  });
  const [assets, setAssets] = useAS([...VData.assets]);
  const [toast, setToast] = useAS(null);

  // Apply tweak attributes to <html>
  useAE(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", t.tema);
    r.setAttribute("data-paleta", t.paleta);
    r.setAttribute("data-tipografia", t.tipografia);
    r.setAttribute("data-densidad", t.densidad);
  }, [t.tema, t.paleta, t.tipografia, t.densidad]);

  // Update balances
  useAE(() => {
    const off = VData.subscribe("balances", (a) => setAssets([...a]));
    return off;
  }, []);

  // Hash navigation
  useAE(() => {
    const h = (e) => {
      const r = (location.hash || "").replace(/^#/, "");
      if (["trading", "mercados", "wallet", "factory", "blockchain", "admin"].includes(r)) setRoute(r);
    };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  // Block-created toast
  useAE(() => {
    const off = VData.subscribe("block", (b) => {
      setToast({ key: b.n, type: "block", title: `Bloque #${b.n} firmado`, sub: `${b.txCount} tx · ${b.sig}` });
      const id = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(id);
    });
    return off;
  }, []);

  const totalWallet = assets.reduce((s, a) => s + a.value, 0);

  const navigate = (r) => {
    setRoute(r);
    location.hash = r;
  };

  return (
    <div className="app" data-screen-label={route}>
      <Sidebar active={route} onNavigate={navigate} />
      <Topbar walletValue={totalWallet} />
      <main className="main">
        {route === "trading" && <TradingScreen chartType={t.grafico} />}
        {route === "mercados" && <MercadosScreen />}
        {route === "wallet" && <WalletScreen />}
        {route === "factory" && <FactoryScreen />}
        {route === "blockchain" && <BlockchainScreen />}
        {route === "admin" && <AdminScreen />}
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast-stack">
          <div className="toast" key={toast.key}>
            <span className="live-dot" />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ fontSize: 12 }}>{toast.title}</strong>
              <span className="dim mono" style={{ fontSize: 11 }}>{toast.sub}</span>
            </div>
          </div>
        </div>
      )}

      <TweaksPanel title="Tweaks · Vértice">
        <TweakSection label="Apariencia" />
        <TweakRadio label="Tema" value={t.tema}
                    options={[{ value: "oscuro", label: "Oscuro" }, { value: "claro", label: "Claro" }]}
                    onChange={(v) => setTweak("tema", v)} />
        <TweakRadio label="Paleta de acento" value={t.paleta}
                    options={[
                      { value: "mineral", label: "Mineral" },
                      { value: "cobalto", label: "Cobalto" },
                      { value: "mostaza", label: "Mostaza" },
                    ]}
                    onChange={(v) => setTweak("paleta", v)} />
        <TweakRadio label="Tipografía" value={t.tipografia}
                    options={[
                      { value: "tecnico", label: "Técnico" },
                      { value: "editorial", label: "Editorial" },
                    ]}
                    onChange={(v) => setTweak("tipografia", v)} />
        <TweakRadio label="Densidad" value={t.densidad}
                    options={[
                      { value: "compacta", label: "Compacta" },
                      { value: "normal", label: "Normal" },
                    ]}
                    onChange={(v) => setTweak("densidad", v)} />

        <TweakSection label="Gráfico" />
        <TweakRadio label="Tipo" value={t.grafico}
                    options={[
                      { value: "velas", label: "Velas" },
                      { value: "linea", label: "Línea" },
                      { value: "area", label: "Área" },
                      { value: "barras", label: "Barras" },
                    ]}
                    onChange={(v) => setTweak("grafico", v)} />

        <TweakSection label="Navegación rápida" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["trading", "Trading"],
            ["mercados", "Mercados"],
            ["wallet", "Wallet"],
            ["factory", "Crear"],
            ["blockchain", "Blockchain"],
            ["admin", "Admin"],
          ].map(([id, label]) => (
            <TweakButton key={id} label={label} secondary={route !== id} onClick={() => navigate(id)} />
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
