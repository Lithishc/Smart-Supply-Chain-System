import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const tableBody = document.querySelector('#offers-table tbody');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to view your offers.");
    window.location.href = "../login.html";
    return;
  }
  loadOffers(user.uid);
});

async function loadOffers(uid) {
  tableBody.innerHTML = "";
  const offersSnap = await getDocs(collection(db, "users", uid, "offers"));
  if (offersSnap.empty) {
    tableBody.innerHTML = `<tr><td colspan="6">No offers made yet.</td></tr>`;
    return;
  }
  for (const docSnap of offersSnap.docs) {
    const offer = docSnap.data();
    const date = offer.createdAt?.toDate ? offer.createdAt.toDate() : new Date(offer.createdAt);
    let orderStatus = "-";
    let itemName = "-";
    let itemDetails = "-";
    let requestedQty = "-";

    // Fetch item details from global procurementRequests using requestId
    if (offer.requestId) {
      const globalReqRef = doc(db, "globalProcurementRequests", offer.requestId);
      const globalReqSnap = await getDoc(globalReqRef);
      if (globalReqSnap.exists()) {
        const globalReq = globalReqSnap.data();
        itemName = globalReq.itemName || "-";
        itemDetails = globalReq.details || "-";
        requestedQty = globalReq.requestedQty || "-";
      }
    }

    // Try to get related order status if offer is accepted
    if (offer.status === "accepted" && offer.offerId) {
      const ordersSnap = await getDocs(collection(db, "users", uid, "orders"));
      for (const orderDoc of ordersSnap.docs) {
        const order = orderDoc.data();
        if (order.offerId === offer.offerId) {
          orderStatus = order.status || "-";
          break;
        }
      }
    }

    tableBody.innerHTML += `
      <tr>
        <td>${itemName}</td>
        <td>₹${offer.price}</td>
        <td>${offer.details}</td>
        <td>
          <span class="offer-status ${offer.status}">
            ${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
          </span>
        </td>
        <td>${orderStatus}</td>
        <td>${date.toLocaleString()}</td>
      </tr>
    `;
  }
}