import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const tableBody = document.querySelector('#supplier-table tbody');

async function loadOpenRequests() {
  tableBody.innerHTML = "";
  const reqSnap = await getDocs(collection(db, "procurementRequests"));
  reqSnap.forEach((docSnap) => {
    const req = docSnap.data();
    if (req.status === "open") {
      tableBody.innerHTML += `
        <tr>
          <td>${req.itemName}</td>
          <td>${req.requestedQty}</td>
          <td>
            <form onsubmit="window.sendOffer(event, '${docSnap.id}')">
              <input type="text" name="supplierName" placeholder="Your Name" required>
              <input type="number" name="price" placeholder="Offer Price" required>
              <input type="text" name="details" placeholder="Details" required>
              <button type="submit">Send Offer</button>
            </form>
          </td>
        </tr>
      `;
    }
  });
}

// This function must be global for inline form onsubmit
window.sendOffer = async (e, reqId) => {
  e.preventDefault();
  const form = e.target;
  const supplierName = form.supplierName.value;
  const price = form.price.value;
  const details = form.details.value;
  const reqRef = doc(db, "procurementRequests", reqId);
  await updateDoc(reqRef, {
    supplierResponses: arrayUnion({ supplierName, price, details })
  });
  alert("Offer sent!");
  loadOpenRequests();
};

loadOpenRequests();