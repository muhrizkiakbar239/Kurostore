const billsWorkspace = document.querySelector("#bills-purchase-workspace");
const billsShell = document.querySelector(".bills-shell");

if (billsWorkspace instanceof HTMLElement && billsShell instanceof HTMLElement) {
  const billsGamePicker = billsWorkspace.querySelector("#bills-game-picker");
  const billsPurchasePanel = billsWorkspace.querySelector("#bills-purchase-panel");
  const billsForm = billsWorkspace.querySelector("#bills-order-form");
  const billsTitle = billsWorkspace.querySelector("#bills-workspace-title");
  const billsGameTitle = billsWorkspace.querySelector("#bills-game-title");
  const billsPurchaseTitle = billsWorkspace.querySelector("#bills-purchase-title");
  const billsPurchaseCopy = billsWorkspace.querySelector("#bills-purchase-copy");
  const billsStep = billsWorkspace.querySelector("#bills-purchase-step");
  const billsTargetFields = billsWorkspace.querySelector(".bills-target-fields");
  const billsTargetLabel = billsWorkspace.querySelector("#bills-target-label");
  const billsTarget = billsWorkspace.querySelector("#bills-target");
  const billsSecondaryField = billsWorkspace.querySelector("#bills-secondary-field");
  const billsSecondaryLabel = billsWorkspace.querySelector("#bills-secondary-label");
  const billsSecondaryTarget = billsWorkspace.querySelector("#bills-secondary-target");
  const billsGameLookup = billsWorkspace.querySelector("#bills-game-lookup");
  const billsGameLookupStatus = billsWorkspace.querySelector("#bills-game-lookup-status");
  const billsGameLookupLogin = billsWorkspace.querySelector("#bills-game-lookup-login");
  const billsGameLookupRetry = billsWorkspace.querySelector("#bills-game-lookup-retry");
  const billsProviderField = billsWorkspace.querySelector("#bills-provider-field");
  const billsProviderLabel = billsWorkspace.querySelector("#bills-provider-label");
  const billsProvider = billsWorkspace.querySelector("#bills-provider");
  const billsSelectedGameImage = billsWorkspace.querySelector("#bills-selected-game-image");
  const billsProductGrid = billsWorkspace.querySelector("#bills-product-grid");
  const billsSelectedProduct = billsWorkspace.querySelector("#bills-selected-product");
  const billsOrderTotal = billsWorkspace.querySelector("#bills-order-total");
  const billsSubmit = billsWorkspace.querySelector("#bills-submit");
  const billsResult = billsWorkspace.querySelector("#bills-order-status");
  const billsResultCopy = billsWorkspace.querySelector("#bills-order-status-copy");
  const serviceOptions = {
    pulsa: {
      title: "Pulsa",
      targetLabel: "Nomor HP tujuan",
      placeholder: "Contoh: 081234567890",
      inputMode: "tel",
      pattern: "(?:\\+?62|0)8[0-9]{7,11}",
      providerLabel: "Pilih operator",
      providers: ["Telkomsel", "Indosat", "XL", "Tri", "Smartfren", "by.U"],
      products: [
        { name: "Pulsa 5.000", detail: "Pulsa reguler" },
        { name: "Pulsa 10.000", detail: "Pulsa reguler" },
        { name: "Pulsa 20.000", detail: "Pulsa reguler" },
        { name: "Pulsa 50.000", detail: "Pulsa reguler" },
        { name: "Pulsa 100.000", detail: "Pulsa reguler" },
        { name: "Pulsa 200.000", detail: "Pulsa reguler" },
      ],
    },
    data: {
      title: "Paket Data",
      targetLabel: "Nomor HP tujuan",
      placeholder: "Contoh: 081234567890",
      inputMode: "tel",
      pattern: "(?:\\+?62|0)8[0-9]{7,11}",
      providerLabel: "Pilih operator",
      providers: ["Telkomsel", "Indosat", "XL", "Tri", "Smartfren", "by.U"],
      products: [
        { name: "2 GB", detail: "Masa aktif 3 hari" },
        { name: "5 GB", detail: "Masa aktif 7 hari" },
        { name: "10 GB", detail: "Masa aktif 30 hari" },
        { name: "18 GB", detail: "Masa aktif 30 hari" },
        { name: "30 GB", detail: "Masa aktif 30 hari" },
        { name: "50 GB", detail: "Masa aktif 30 hari" },
      ],
    },
    phone: {
      title: "Telepon & SMS",
      targetLabel: "Nomor telepon tujuan",
      placeholder: "Contoh: 0215550123",
      inputMode: "tel",
      pattern: "0[0-9]{8,12}",
      providerLabel: "Pilih operator",
      providers: ["Telkomsel", "Indosat", "XL", "Tri", "Smartfren"],
      products: [
        { name: "Paket 10 menit", detail: "Paket telepon" },
        { name: "Paket 30 menit", detail: "Paket telepon" },
        { name: "Paket SMS 100", detail: "Paket SMS" },
        { name: "Paket SMS 500", detail: "Paket SMS" },
      ],
    },
    game: { title: "Top Up Game", chooseGame: true },
    streaming: {
      title: "Voucher Streaming",
      targetLabel: "Email akun",
      placeholder: "nama@contoh.com",
      inputMode: "email",
      providerLabel: "Pilih layanan streaming",
      providers: ["Netflix", "Spotify Premium", "YouTube Premium", "Vidio"],
      products: [
        { name: "1 Bulan", detail: "Paket personal" },
        { name: "3 Bulan", detail: "Paket personal" },
        { name: "6 Bulan", detail: "Paket personal" },
      ],
    },
    "digital-voucher": {
      title: "Voucher Digital",
      targetLabel: "Email penerima",
      placeholder: "nama@contoh.com",
      inputMode: "email",
      providerLabel: "Pilih platform",
      providers: ["Google Play", "Apple Gift Card", "Steam Wallet"],
      products: [
        { name: "Voucher 20.000", detail: "Kode digital" },
        { name: "Voucher 50.000", detail: "Kode digital" },
        { name: "Voucher 100.000", detail: "Kode digital" },
        { name: "Voucher 200.000", detail: "Kode digital" },
      ],
    },
    ewallet: {
      title: "E-Wallet",
      targetLabel: "Nomor HP akun e-wallet",
      placeholder: "Contoh: 081234567890",
      inputMode: "tel",
      pattern: "(?:\\+?62|0)8[0-9]{7,11}",
      providerLabel: "Pilih e-wallet",
      providers: ["DANA", "GoPay", "OVO", "ShopeePay", "LinkAja"],
      products: [
        { name: "Saldo 10.000", detail: "Nominal saldo" },
        { name: "Saldo 20.000", detail: "Nominal saldo" },
        { name: "Saldo 50.000", detail: "Nominal saldo" },
        { name: "Saldo 100.000", detail: "Nominal saldo" },
      ],
    },
    "electric-token": {
      title: "Token Listrik",
      targetLabel: "Nomor meter / ID pelanggan",
      placeholder: "Masukkan nomor meter",
      inputMode: "numeric",
      products: [
        { name: "Token 20.000", detail: "Token prabayar" },
        { name: "Token 50.000", detail: "Token prabayar" },
        { name: "Token 100.000", detail: "Token prabayar" },
        { name: "Token 200.000", detail: "Token prabayar" },
      ],
    },
    "electric-bill": {
      title: "Tagihan Listrik",
      targetLabel: "ID pelanggan PLN",
      placeholder: "Masukkan ID pelanggan",
      inputMode: "numeric",
      products: [
        { name: "Tagihan 50.000", detail: "Nilai tagihan" },
        { name: "Tagihan 100.000", detail: "Nilai tagihan" },
        { name: "Tagihan 200.000", detail: "Nilai tagihan" },
        { name: "Tagihan 500.000", detail: "Nilai tagihan" },
      ],
    },
    water: {
      title: "PDAM",
      targetLabel: "Nomor pelanggan PDAM",
      placeholder: "Masukkan nomor pelanggan",
      inputMode: "numeric",
      products: [
        { name: "Tagihan 50.000", detail: "Nilai tagihan" },
        { name: "Tagihan 100.000", detail: "Nilai tagihan" },
        { name: "Tagihan 200.000", detail: "Nilai tagihan" },
      ],
    },
    internet: {
      title: "Internet & TV Kabel",
      targetLabel: "ID pelanggan internet / TV",
      placeholder: "Masukkan ID pelanggan",
      inputMode: "text",
      providerLabel: "Pilih provider",
      providers: ["IndiHome", "First Media", "Biznet", "MyRepublic", "MNC Play"],
      products: [
        { name: "Tagihan 100.000", detail: "Nilai tagihan" },
        { name: "Tagihan 250.000", detail: "Nilai tagihan" },
        { name: "Tagihan 500.000", detail: "Nilai tagihan" },
      ],
    },
    bpjs: {
      title: "BPJS",
      targetLabel: "Nomor peserta BPJS",
      placeholder: "Masukkan nomor peserta",
      inputMode: "numeric",
      products: [
        { name: "Kelas 1", detail: "Iuran bulanan" },
        { name: "Kelas 2", detail: "Iuran bulanan" },
        { name: "Kelas 3", detail: "Iuran bulanan" },
      ],
    },
    tax: {
      title: "Pajak",
      targetLabel: "Nomor objek pajak / tagihan",
      placeholder: "Masukkan nomor tagihan",
      inputMode: "text",
      products: [
        { name: "Tagihan 100.000", detail: "Nilai pajak" },
        { name: "Tagihan 250.000", detail: "Nilai pajak" },
        { name: "Tagihan 500.000", detail: "Nilai pajak" },
      ],
    },
    travel: {
      title: "Tiket & Transportasi",
      targetLabel: "Kode booking / nama penumpang",
      placeholder: "Masukkan kode booking atau nama",
      inputMode: "text",
      providerLabel: "Pilih layanan",
      providers: ["KAI", "Garuda Indonesia", "Citilink", "TransJakarta"],
      products: [
        { name: "Tiket 50.000", detail: "Biaya tiket" },
        { name: "Tiket 150.000", detail: "Biaya tiket" },
        { name: "Tiket 300.000", detail: "Biaya tiket" },
      ],
    },
  };
  const games = {
    ml: {
      title: "Mobile Legends",
      lookupKey: "ml",
      image: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/game-mobile-legends.webp",
      currency: "Diamond",
      targetLabel: "User ID",
      placeholder: "Masukkan User ID",
      inputMode: "numeric",
      secondaryLabel: "Zone ID",
      secondaryPlaceholder: "Masukkan Zone ID",
      products: [
        { name: "86 Diamond", detail: "Paket Diamond" },
        { name: "172 Diamond", detail: "Paket Diamond" },
        { name: "257 Diamond", detail: "Paket Diamond" },
        { name: "344 Diamond", detail: "Paket Diamond" },
        { name: "706 Diamond", detail: "Paket Diamond" },
        { name: "1412 Diamond", detail: "Paket Diamond" },
      ],
    },
    ff: {
      title: "Free Fire",
      lookupKey: "ff",
      image: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/game-free-fire.jpg",
      currency: "Diamond",
      targetLabel: "Player ID",
      placeholder: "Masukkan Player ID",
      inputMode: "numeric",
      products: [
        { name: "70 Diamond", detail: "Paket Diamond" },
        { name: "140 Diamond", detail: "Paket Diamond" },
        { name: "355 Diamond", detail: "Paket Diamond" },
        { name: "720 Diamond", detail: "Paket Diamond" },
        { name: "1450 Diamond", detail: "Paket Diamond" },
      ],
    },
    roblox: {
      title: "Roblox",
      lookupKey: "roblox",
      image: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/game-roblox.jpg",
      currency: "Robux",
      targetLabel: "Username Roblox",
      placeholder: "Masukkan username Roblox",
      inputMode: "text",
      minLength: 3,
      products: [
        { name: "80 Robux", detail: "Paket Robux" },
        { name: "160 Robux", detail: "Paket Robux" },
        { name: "400 Robux", detail: "Paket Robux" },
        { name: "800 Robux", detail: "Paket Robux" },
      ],
    },
    genshin: {
      title: "Genshin Impact",
      lookupKey: "genshin",
      image: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/game-genshin-impact.jpg",
      currency: "Genesis Crystal",
      targetLabel: "UID Genshin Impact",
      placeholder: "Masukkan UID Genshin Impact",
      inputMode: "numeric",
      products: [
        { name: "60 Crystal", detail: "Paket Genesis Crystal" },
        { name: "300 + 30 Crystal", detail: "Paket Genesis Crystal" },
        { name: "980 + 110 Crystal", detail: "Paket Genesis Crystal" },
        { name: "1980 + 260 Crystal", detail: "Paket Genesis Crystal" },
      ],
    },
    hsr: {
      title: "Honkai: Star Rail",
      lookupKey: "hsr",
      image: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/game-honkai-star-rail.webp",
      currency: "Oneiric Shard",
      targetLabel: "UID Honkai: Star Rail",
      placeholder: "Masukkan UID Honkai: Star Rail",
      inputMode: "numeric",
      products: [
        { name: "60 Shard", detail: "Paket Oneiric Shard" },
        { name: "300 + 30 Shard", detail: "Paket Oneiric Shard" },
        { name: "980 + 110 Shard", detail: "Paket Oneiric Shard" },
        { name: "1980 + 260 Shard", detail: "Paket Oneiric Shard" },
      ],
    },
    wuwa: {
      title: "Wuthering Waves",
      lookupMinLength: 9,
      lookupUnavailableMessage: "Belum ada API publik yang bisa memeriksa nickname Wuthering Waves dari UID. Pastikan nickname langsung di dalam game.",
      image: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/game-wuthering-waves.webp",
      currency: "Lunite",
      targetLabel: "UID Wuthering Waves",
      placeholder: "Masukkan UID Wuthering Waves",
      inputMode: "numeric",
      minLength: 9,
      pattern: "[0-9]{9,10}",
      products: [
        { name: "60 Lunite", detail: "Paket Lunite" },
        { name: "300 + 30 Lunite", detail: "Paket Lunite" },
        { name: "980 + 110 Lunite", detail: "Paket Lunite" },
        { name: "1980 + 260 Lunite", detail: "Paket Lunite" },
      ],
    },
  };
  let selectedServiceKey = null;
  let selectedService = null;
  let selectedGame = null;
  let selectedProduct = null;
  let serviceTrigger = null;
  let gameLookupTimer = null;
  let gameLookupRequestId = 0;
  let lastGameLookupSignature = null;
  const gameLookupCache = new Map();

  function updateOrderSummary() {
    if (billsSelectedProduct) billsSelectedProduct.textContent = selectedProduct?.name || "Belum dipilih";
    if (billsOrderTotal) billsOrderTotal.textContent = "Belum tersedia";
    if (billsSubmit) billsSubmit.disabled = !selectedProduct;
  }

  function renderProducts(products) {
    if (!billsProductGrid) return;

    billsProductGrid.replaceChildren(...products.map((product) => {
      const option = document.createElement("button");
      option.className = "bills-product-option";
      option.type = "button";
      option.setAttribute("aria-pressed", "false");

      const details = document.createElement("span");
      details.className = "bills-product-details";
      const name = document.createElement("strong");
      name.textContent = product.name;
      const description = document.createElement("small");
      description.textContent = product.detail;
      details.append(name, description);

      option.append(details);
      option.addEventListener("click", () => {
        selectedProduct = product;
        billsProductGrid.querySelectorAll(".bills-product-option").forEach((item) => {
          const isSelected = item === option;
          item.classList.toggle("is-selected", isSelected);
          item.setAttribute("aria-pressed", String(isSelected));
        });
        updateOrderSummary();
      });
      return option;
    }));
    selectedProduct = null;
    updateOrderSummary();
  }

  function configureTarget(targetConfig) {
    if (!billsTarget || !billsTargetLabel) return;
    billsTargetLabel.textContent = targetConfig.targetLabel;
    billsTarget.placeholder = targetConfig.placeholder || "";
    billsTarget.inputMode = targetConfig.inputMode || "text";
    billsTarget.minLength = targetConfig.minLength || 4;
    billsTarget.removeAttribute("pattern");
    billsTarget.title = "";
    if (targetConfig.pattern) {
      billsTarget.pattern = targetConfig.pattern;
      billsTarget.title = "Masukkan nomor tujuan dengan format yang valid.";
    }

    if (billsSecondaryField && billsSecondaryTarget && billsSecondaryLabel) {
      const hasSecondaryTarget = Boolean(targetConfig.secondaryLabel);
      billsTargetFields?.classList.toggle("has-secondary-target", hasSecondaryTarget);
      billsSecondaryField.hidden = !hasSecondaryTarget;
      billsSecondaryTarget.required = hasSecondaryTarget;
      billsSecondaryLabel.textContent = targetConfig.secondaryLabel || "";
      billsSecondaryTarget.placeholder = targetConfig.secondaryPlaceholder || "";
    }
  }

  function configureProvider(service) {
    if (!billsProviderField || !billsProviderLabel || !billsProvider) return;
    const providers = service.providers || [];
    billsForm?.classList.toggle("has-provider-field", providers.length > 0);
    billsProviderField.hidden = providers.length === 0;
    billsProvider.required = providers.length > 0;
    billsProviderLabel.textContent = service.providerLabel || "Pilih provider";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Pilih salah satu";
    billsProvider.replaceChildren(placeholder, ...providers.map((provider) => {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = provider;
      return option;
    }));
  }

  function setGameLookupStatus(message, state = "info", showLogin = false, showRetry = false) {
    if (!(billsGameLookup instanceof HTMLElement)
      || !(billsGameLookupStatus instanceof HTMLElement)
      || !(billsGameLookupLogin instanceof HTMLAnchorElement)
      || !(billsGameLookupRetry instanceof HTMLButtonElement)) return;

    billsGameLookup.hidden = !message;
    billsGameLookup.dataset.state = state;
    billsGameLookupStatus.textContent = message;
    billsGameLookupLogin.hidden = !showLogin;
    billsGameLookupRetry.hidden = !showRetry;
  }

  function resetGameLookup() {
    if (gameLookupTimer) clearTimeout(gameLookupTimer);
    gameLookupTimer = null;
    gameLookupRequestId += 1;
    lastGameLookupSignature = null;
    setGameLookupStatus("");
  }

  async function checkGameAccount(userId, zone, signature, requestId) {
    const accessToken = sessionStorage.getItem("kurostore-access-token");
    if (!accessToken) {
      setGameLookupStatus("Masuk ke akun untuk memeriksa nama akun game.", "info", true);
      return;
    }

    lastGameLookupSignature = signature;
    setGameLookupStatus("Sedang memeriksa ID game...", "loading");
    try {
      const response = await window.KurostoreAuth.fetch("/api/game/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          game: selectedGame.lookupKey,
          user_id: userId,
          ...(zone ? { zone } : {}),
        }),
      });
      const result = await response.json().catch(() => null);
      if (requestId !== gameLookupRequestId) return;
      if (response.status === 401) {
        setGameLookupStatus("Sesi akun sudah berakhir. Masuk kembali untuk melanjutkan pengecekan.", "error", true);
        return;
      }
      if (!response.ok) {
        throw new Error(typeof result?.error === "string"
          ? result.error
          : "Nama akun tidak dapat diperiksa. Coba lagi.");
      }

      const accountName = typeof result?.accountName === "string" ? result.accountName.trim() : "";
      if (!accountName) throw new Error("Provider tidak mengembalikan nama akun untuk ID ini.");

      gameLookupCache.set(signature, accountName);
      if (gameLookupCache.size > 20) {
        gameLookupCache.delete(gameLookupCache.keys().next().value);
      }
      setGameLookupStatus(`Nama akun: ${accountName}`, "success");
    } catch (error) {
      if (requestId !== gameLookupRequestId) return;
      setGameLookupStatus(error instanceof Error
        ? error.message
        : "Nama akun tidak dapat diperiksa. Coba lagi.", "error", false, true);
    }
  }

  function scheduleGameAccountCheck() {
    if (gameLookupTimer) clearTimeout(gameLookupTimer);
    gameLookupTimer = null;
    const requestId = ++gameLookupRequestId;

    if (!selectedGame || !billsTarget) {
      setGameLookupStatus("");
      return;
    }

    const userId = billsTarget.value.trim();
    const zone = billsSecondaryTarget?.value.trim() || "";
    if (userId.length < (selectedGame.lookupMinLength || 3) || (selectedGame.secondaryLabel && !zone)) {
      setGameLookupStatus("");
      return;
    }

    if (!selectedGame.lookupKey) {
      setGameLookupStatus(
        selectedGame.lookupUnavailableMessage
          || `Pengecekan otomatis gratis belum tersedia untuk ${selectedGame.title}. Pastikan ID game sudah benar.`,
        "info",
      );
      return;
    }

    const signature = JSON.stringify([selectedGame.lookupKey, userId, zone]);
    const cachedName = gameLookupCache.get(signature);
    if (cachedName) {
      setGameLookupStatus(`Nama akun: ${cachedName}`, "success");
      return;
    }
    if (signature === lastGameLookupSignature) return;

    if (!sessionStorage.getItem("kurostore-access-token")) {
      setGameLookupStatus("Masuk ke akun untuk memeriksa nama akun game.", "info", true);
      return;
    }

    gameLookupTimer = setTimeout(() => {
      void checkGameAccount(userId, zone, signature, requestId);
    }, 850);
  }

  function showPurchasePanel(service, game = null) {
    if (!billsForm || !billsPurchasePanel || !billsGamePicker || !billsPurchaseTitle || !billsPurchaseCopy || !billsStep) return;

    selectedGame = game;
    resetGameLookup();
    billsWorkspace.classList.add("has-purchase-panel");
    billsGamePicker.hidden = true;
    billsPurchasePanel.hidden = false;
    billsForm.hidden = false;
    billsResult.hidden = true;
    billsForm.reset();
    if (billsTitle) billsTitle.textContent = service.title;
    billsPurchaseTitle.textContent = game ? `Top Up • ${game.title}` : service.title;
    billsPurchaseCopy.textContent = game
      ? `Masukkan data akun dan pilih nominal ${game.currency}.`
      : "Isi detail tujuan, lalu pilih produk yang diinginkan.";
    billsStep.textContent = game ? "LANGKAH 2 DARI 2" : "PILIHAN PRODUK";
    configureTarget(game ? game : service);
    configureProvider(service);
    renderProducts(game ? game.products : service.products);

    const backButton = billsWorkspace.querySelector("[data-bills-back-games]");
    if (backButton instanceof HTMLButtonElement) backButton.hidden = !service.chooseGame;
    if (billsSelectedGameImage instanceof HTMLImageElement) {
      billsSelectedGameImage.hidden = !game;
      billsSelectedGameImage.src = game?.image || "";
      billsSelectedGameImage.alt = game ? `Logo ${game.title}` : "";
    }
    billsTarget?.focus();
  }

  document.querySelectorAll("[data-bills-service]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedServiceKey = button.dataset.billsService || null;
      selectedService = selectedServiceKey ? serviceOptions[selectedServiceKey] : null;
      selectedGame = null;

      if (!selectedService || !billsTitle || !billsGamePicker || !billsPurchasePanel || !billsResult || !billsForm) {
        console.error("Unable to open bills service: required page elements are missing.");
        return;
      }

      serviceTrigger = button;
      billsShell.classList.add("is-workspace-open");
      billsWorkspace.hidden = false;
      billsTitle.textContent = selectedService.chooseGame ? "Pilih game" : selectedService.title;
      if (billsGameTitle) {
        billsGameTitle.textContent = "Pilih game yang ingin di-top up";
      }
      billsGamePicker.hidden = !selectedService.chooseGame;
      billsPurchasePanel.hidden = Boolean(selectedService.chooseGame);
      billsWorkspace.classList.toggle("has-purchase-panel", !selectedService.chooseGame);
      billsForm.hidden = false;
      billsResult.hidden = true;
      if (!selectedService.chooseGame) showPurchasePanel(selectedService);
      if (selectedService.chooseGame) {
        billsGamePicker.querySelector("button")?.focus();
      }
    });
  });

  billsWorkspace.querySelectorAll("[data-bills-game]").forEach((button) => {
    button.addEventListener("click", () => {
      const game = games[button.dataset.billsGame];
      if (!selectedService?.chooseGame || !game) {
        console.error("Unable to select bills service game:", button.dataset.billsGame);
        return;
      }
      showPurchasePanel(selectedService, game);
    });
  });

  billsWorkspace.querySelector("[data-bills-back-games]")?.addEventListener("click", () => {
    if (!selectedService?.chooseGame || !billsGamePicker || !billsPurchasePanel) return;
    selectedGame = null;
    resetGameLookup();
    billsWorkspace.classList.remove("has-purchase-panel");
    billsPurchasePanel.hidden = true;
    billsGamePicker.hidden = false;
    billsTitle.textContent = "Pilih game";
    billsGameTitle.textContent = "Pilih game yang ingin di-top up";
    billsGamePicker.querySelector("button")?.focus();
  });

  billsTarget?.addEventListener("input", scheduleGameAccountCheck);
  billsSecondaryTarget?.addEventListener("input", scheduleGameAccountCheck);
  billsGameLookupRetry?.addEventListener("click", () => {
    lastGameLookupSignature = null;
    scheduleGameAccountCheck();
  });

  billsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedService || !billsTarget || !billsResult || !billsResultCopy || !billsForm.reportValidity()) return;
    if (!selectedProduct) {
      billsProductGrid?.querySelector("button")?.focus();
      return;
    }

    const provider = billsProviderField && !billsProviderField.hidden ? billsProvider?.value : "";
    const providerText = provider ? ` • ${provider}` : "";
    billsResultCopy.textContent = `${selectedProduct.name}${providerText} dipilih. Harga belum tersedia dan pemesanan belum dibuka, jadi belum ada pesanan atau pembayaran yang dibuat.`;
    billsForm.hidden = true;
    billsResult.hidden = false;
    billsWorkspace.querySelector("[data-bills-retry]")?.focus();
  });

  billsWorkspace.querySelector("[data-bills-close]")?.addEventListener("click", () => {
    selectedServiceKey = null;
    selectedService = null;
    selectedGame = null;
    selectedProduct = null;
    resetGameLookup();
    billsForm?.reset();
    billsWorkspace.hidden = true;
    if (billsGamePicker) billsGamePicker.hidden = true;
    if (billsPurchasePanel) billsPurchasePanel.hidden = true;
    if (billsForm) billsForm.hidden = false;
    if (billsResult) billsResult.hidden = true;
    updateOrderSummary();
    billsWorkspace.classList.remove("has-purchase-panel");
    billsShell.classList.remove("is-workspace-open");
    serviceTrigger?.focus();
    serviceTrigger = null;
  });
  billsWorkspace.querySelector("[data-bills-retry]")?.addEventListener("click", () => {
    if (!selectedService) return;
    billsResult.hidden = true;
    showPurchasePanel(selectedService, selectedGame);
  });
}
