let web3, userAddress = null;

const routerAddress = "0x6af29450dfe0d0f0179875e9945ab614723a3c21"; // LegendSwapRouter
const rewardTokenAddress = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d"; // Reward Contract (optional)
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // WBNB address on BSC

let router;

window.addEventListener("load", () => disableUI(true));

async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  web3 = new Web3(window.ethereum);
  const accounts = await web3.eth.getAccounts();
  userAddress = accounts[0];
  document.getElementById("walletAddress").innerText = userAddress;
  document.getElementById("connectButton").innerText = "🔌 Connected";

  router = new web3.eth.Contract(legendSwapRouterABI, routerAddress);
  fillTokenOptions();
  disableUI(false);
  updatePriceInfo();
  ["fromToken", "toToken", "amount"].forEach(id =>
    document.getElementById(id).addEventListener("input", updatePriceInfo)
  );
}

function disableUI(dis) {
  ["fromToken", "toToken", "amount", "swapButton", "reverseButton"]
    .forEach(id => document.getElementById(id).disabled = dis);
}

function fillTokenOptions() {
  ["fromToken", "toToken"].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    tokens.forEach(t => sel.add(new Option(t.symbol, t.address)));
  });
}

function getSymbol(addr) {
  const t = tokens.find(x => x.address.toLowerCase() === addr.toLowerCase());
  return t ? t.symbol : "";
}

function getSwapPath(from, to) {
  const wrappedFrom = from.toLowerCase() === "bnb" ? WBNB : from;
  const wrappedTo = to.toLowerCase() === "bnb" ? WBNB : to;
  if (wrappedFrom === WBNB || wrappedTo === WBNB) {
    return [wrappedFrom, wrappedTo];
  } else {
    return [wrappedFrom, WBNB, wrappedTo];
  }
}

async function updatePriceInfo() {
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  if (!amount || from === to) {
    document.getElementById("priceInfo").innerText = "-";
    return;
  }

  try {
    const inWei = web3.utils.toWei(amount.toString(), "ether");
    const routerView = new web3.eth.Contract(pancakeRouterABI, "0x10ED43C718714eb63d5aA57B78B54704E256024E");
    const path = getSwapPath(from, to);
    const amounts = await routerView.methods.getAmountsOut(inWei, path).call();
    const outAmount = web3.utils.fromWei(amounts[amounts.length - 1], "ether");
    document.getElementById("priceInfo").innerText = `${parseFloat(outAmount).toFixed(6)} ${getSymbol(to)}`;
  } catch (err) {
    console.warn("⚠️ Price fetch error:", err.message);
    document.getElementById("priceInfo").innerText = "❌";
  }
}

function reverseTokens() {
  const f = document.getElementById("fromToken");
  const t = document.getElementById("toToken");
  [f.value, t.value] = [t.value, f.value];
  updatePriceInfo();
}

async function swapTokens() {
  if (!userAddress) return alert("Wallet not connected.");

  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  if (!amount || from === to) return alert("Invalid amount or same tokens selected.");

  const inWei = web3.utils.toWei(amount.toString(), "ether");
  const path = getSwapPath(from, to);
  const deadline = Math.floor(Date.now() / 1000) + 600;

  try {
    document.getElementById("status").innerText = "Processing...";

    if (from.toLowerCase() === "bnb") {
      await router.methods.swapETHForTokens(
        0, path, deadline
      ).send({ from: userAddress, value: inWei });

    } else if (to.toLowerCase() === "bnb") {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(routerAddress, inWei).send({ from: userAddress });
      await router.methods.swapTokensForETH(
        inWei, 0, path, deadline
      ).send({ from: userAddress });

    } else {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(routerAddress, inWei).send({ from: userAddress });
      await router.methods.swapTokensForTokens(
        inWei, 0, path, deadline
      ).send({ from: userAddress });
    }

    document.getElementById("status").innerText = "✅ Swap successful! 🎉 Reward claimed.";

  } catch (err) {
    console.error("Swap error:", err);
    document.getElementById("status").innerText = "❌ Error in swap!";
  }
}
