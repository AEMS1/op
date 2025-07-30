let web3, userAddress = null;

const swapContractAddress = "0x6af29450dfe0d0f0179875e9945ab614723a3c21";
const rewardContractAddress = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d";
const owner = "0xec54951C7d4619256Ea01C811fFdFa01A9925683";

let swapContract, rewardContract;

window.addEventListener("load", () => disableUI(true));

async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  web3 = new Web3(window.ethereum);
  const accounts = await web3.eth.getAccounts();
  userAddress = accounts[0];
  swapContract = new web3.eth.Contract(swapABI, swapContractAddress);
  rewardContract = new web3.eth.Contract(rewardDistributorABI, rewardContractAddress);
  document.getElementById("walletAddress").innerText = userAddress;
  document.getElementById("connectButton").innerText = "✅ Connected";
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
    const out = await swapContract.methods.estimateOut(from, to, inWei).call();
    const outFormatted = web3.utils.fromWei(out, "ether");
    document.getElementById("priceInfo").innerText = `${parseFloat(outFormatted).toFixed(6)} ${getSymbol(to)}`;
  } catch (err) {
    console.warn("Price estimation error:", err.message);
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
  if (!amount || from === to) return alert("Invalid amount or identical tokens.");

  const inWei = web3.utils.toWei(amount.toString(), "ether");

  try {
    document.getElementById("status").innerText = "🔄 Swapping...";

    if (from === "bnb") {
      await swapContract.methods.swapFromBNB(to).send({
        from: userAddress,
        value: inWei
      });

    } else {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(swapContractAddress, inWei).send({ from: userAddress });
      await swapContract.methods.swap(from, to, inWei).send({ from: userAddress });
    }

    // ✅ پاداش
    document.getElementById("status").innerText = "🎁 Getting reward...";
    await rewardContract.methods.claimReward().send({ from: userAddress });

    document.getElementById("status").innerText = "✅ Swap and reward complete!";
    updatePriceInfo();
  } catch (err) {
    console.error("Swap error:", err.message);
    document.getElementById("status").innerText = "❌ Error during swap.";
  }
}
