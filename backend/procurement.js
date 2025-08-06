import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const tableBody = document.querySelector('#procurement-table tbody');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to access procurement.");
    window.location.href = "../login.html";
    return;
  }
  loadInventoryForProcurement(user.uid);
});

async function loadInventoryForProcurement(uid) {
  tableBody.innerHTML = "";
  const inventorySnap = await getDocs(collection(db, "users", uid, "inventory"));
  for (const itemDoc of inventorySnap.docs) {
    const item = itemDoc.data();
    const presetMode = item.presetMode || false;
    const presetQty = Number(item.presetQty) || 0;
    const requestQty = Number(item.requestQty) || 0; // This is the user-set request quantity
    const quantity = Number(item.quantity) || 0;

    // Check if procurement request already exists for this item and is open
    let existingRequest = null;
    let offersHtml = "-";
    let requestStatus = "-";
    let requestId = null;
    let offerCount = 0;

    // Find the latest procurement request for this item
    const reqQuery = query(
      collection(db, "users", uid, "procurementRequests"),
      where("itemID", "==", item.itemID)
    );
    const reqSnap = await getDocs(reqQuery);

    let lastRequest = null;
    let lastglobalProcurementId = null;
    reqSnap.forEach(docRef => {
      const data = docRef.data();
      // Find the latest request (by createdAt)
      if (!lastRequest || (data.createdAt && data.createdAt > lastRequest.createdAt)) {
        lastRequest = data;
        requestId = docRef.id;
        lastglobalProcurementId = data.globalProcurementId;
        existingRequest = data.status === "open" ? data : existingRequest;
      }
    });

    // --- AUTOMATION: Create request if needed ---
    // Use requestQty if set, otherwise fallback to presetQty
    const qtyToRequest = requestQty > 0 ? requestQty : presetQty;
    // Only automate if no open request OR last request is fulfilled
    const shouldAutomate = presetMode && qtyToRequest > 0 && quantity < presetQty && (!existingRequest && (!lastRequest || lastRequest.fulfilled === true));
    if (shouldAutomate) {
      const requestData = {
        itemID: item.itemID,
        itemName: item.itemName,
        requestedQty: qtyToRequest,
        currentQty: quantity,
        status: "open",
        supplierResponses: [],
        userUid: uid,
        createdAt: new Date(),
        fulfilled: false // Track if order is fulfilled
      };
      // Add to global procurementRequests for suppliers
      const globalReqRef = await addDoc(collection(db, "globalProcurementRequests"), requestData);
      await updateDoc(globalReqRef, { globalProcurementId: globalReqRef.id });

      // Add to user's procurementRequests, store globalProcurementId
      const userReqRef = await addDoc(collection(db, "users", uid, "procurementRequests"), {
        ...requestData,
        globalProcurementId: globalReqRef.id
      });
      await updateDoc(userReqRef, { requestId: userReqRef.id }); // Optionally keep for legacy
    }

    if (existingRequest && Array.isArray(existingRequest.supplierResponses) && existingRequest.supplierResponses.length > 0) {
      offerCount = existingRequest.supplierResponses.length;
      offersHtml = `
        <button onclick="window.viewOffers('${uid}','${lastglobalProcurementId}','${requestId}')">
          View Offers (${offerCount})
        </button>
      `;
      requestStatus = "Offers Received";
    } else if (existingRequest) {
      requestStatus = "Requested";
      offersHtml = "No offers yet";
    }

    tableBody.innerHTML += `
      <tr>
       <td>${item.itemID}</td>
        <td>${item.itemName}</td>
        <td>${item.quantity}</td>
        <td>
          <input type="checkbox" ${presetMode ? "checked" : ""} 
            onchange="window.togglePreset('${itemDoc.id}', this.checked)">
        </td>
        <td>
          <input type="number" min="1" value="${item.presetQty || ""}" style="width:60px;"
            onchange="window.setPresetQty('${itemDoc.id}', this.value)">
        </td>
        <td>
          <input type="number" min="1" value="${item.requestQty || ""}" style="width:60px;"
            onchange="window.setRequestQty('${itemDoc.id}', this.value)">
        </td>
        <td>${requestStatus}</td>
        <td>${offersHtml}</td>
      </tr>
    `;
  }
}

// Modal or section to show offers
window.viewOffers = async (uid, globalProcurementId, userRequestId) => {
  // Always use global request for offers
  const reqRef = doc(db, "globalProcurementRequests", globalProcurementId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  const offers = reqData.supplierResponses || [];
  let html = `<h3>Supplier Offers</h3>`;
  if (offers.length === 0) {
    html += "<p>No offers yet.</p>";
  } else {
    offers.forEach((offer, idx) => {
      html += `
        <div style="border-bottom:1px solid #eee; margin-bottom:10px; padding-bottom:8px;">
          <b>${offer.supplierName}</b>: ₹${offer.price}<br>
          <span>${offer.details}</span><br>
          <button onclick="window.acceptOffer('${uid}','${globalProcurementId}','${userRequestId}',${idx})">Accept</button>
          <button onclick="window.rejectOffer('${uid}','${globalProcurementId}','${userRequestId}',${idx})">Reject</button>
        </div>
      `;
    });
  }
  // Show in a modal or a div (for demo, use alert or a simple div)
  let modal = document.getElementById('offers-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'offers-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.padding = '24px';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 8px 32px 0 rgba(31,38,135,0.18)';
    modal.style.zIndex = '9999';
    modal.innerHTML = `<button onclick="document.body.removeChild(this.parentNode)">Close</button><div id="offers-content"></div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#offers-content').innerHTML = html;
  modal.style.display = 'block';
};


// Accept supplier offer and create order for both dealer and supplier
window.acceptOffer = async (uid, globalProcurementId, userRequestId, offerIdx) => {
  // Get the accepted offer from global
  const globalReqRef = doc(db, "globalProcurementRequests", globalProcurementId);
  const globalReqSnap = await getDoc(globalReqRef);
  if (!globalReqSnap.exists()) return;
  const reqData = globalReqSnap.data();
  const acceptedOffer = reqData.supplierResponses[offerIdx];

  // Update status in global request
  await updateDoc(globalReqRef, {
    status: "ordered",
    acceptedOffer,
    accepted: true
  });

  // Update user's procurementRequests
  const userReqRef = doc(db, "users", uid, "procurementRequests", userRequestId);
  await updateDoc(userReqRef, {
    status: "ordered",
    acceptedOffer,
    accepted: true
  });

  // Add order for dealer (include offerId)
  await addDoc(collection(db, "users", uid, "orders"), {
    procurementId: userRequestId,
    offerId: acceptedOffer.offerId ,
    itemID: reqData.itemID,
    itemName: reqData.itemName,
    quantity: reqData.requestedQty,
    supplier: acceptedOffer.supplierName,
    price: acceptedOffer.price,
    details: acceptedOffer.details,
    status: "ordered",
    createdAt: new Date()
  });

  // Add order for supplier (if supplierUid is present, include offerId)
  if (acceptedOffer.supplierUid) {
    await addDoc(collection(db, "users", acceptedOffer.supplierUid, "orders"), {
      offerId: acceptedOffer.offerId,
      itemID: reqData.itemID,
      itemName: reqData.itemName,
      quantity: reqData.requestedQty,
      dealer: uid,
      price: acceptedOffer.price,
      details: acceptedOffer.details,
      status: "accepted",
      createdAt: new Date()
    });
  }

  alert("Offer accepted and order created!");
  document.getElementById('offers-modal').remove();
  loadInventoryForProcurement(uid);
};

// Reject supplier offer
window.rejectOffer = async (uid, globalProcurementId, userRequestId, offerIdx) => {
  // Update global procurementRequests
  const globalReqRef = doc(db, "globalProcurementRequests", globalProcurementId);
  const globalReqSnap = await getDoc(globalReqRef);
  if (!globalReqSnap.exists()) return;
  const globalData = globalReqSnap.data();
  const removedOffer = globalData.supplierResponses[offerIdx];
  globalData.supplierResponses.splice(offerIdx, 1);
  await updateDoc(globalReqRef, { supplierResponses: globalData.supplierResponses });

  // Also update the user's procurementRequests
  const userReqRef = doc(db, "users", uid, "procurementRequests", userRequestId);
  const userReqSnap = await getDoc(userReqRef);
  if (userReqSnap.exists()) {
    const userData = userReqSnap.data();
    const userOffers = Array.isArray(userData.supplierResponses) ? [...userData.supplierResponses] : [];
    userOffers.splice(offerIdx, 1);
    await updateDoc(userReqRef, { supplierResponses: userOffers });
  }

  alert("Offer rejected.");
  document.getElementById('offers-modal').remove();
  loadInventoryForProcurement(uid);
};

window.togglePreset = async (itemDocId, checked) => {
  const user = auth.currentUser;
  if (!user) return;
  const itemRef = doc(db, "users", user.uid, "inventory", itemDocId);
  await updateDoc(itemRef, { presetMode: checked });
  loadInventoryForProcurement(user.uid);
};

window.setPresetQty = async (itemDocId, qty) => {
  const user = auth.currentUser;
  if (!user) return;
  const itemRef = doc(db, "users", user.uid, "inventory", itemDocId);
  await updateDoc(itemRef, { presetQty: qty });
  loadInventoryForProcurement(user.uid);
};

// Save request quantity to Firestore
window.setRequestQty = async (itemDocId, qty) => {
  const user = auth.currentUser;
  if (!user) return;
  const itemRef = doc(db, "users", user.uid, "inventory", itemDocId);
  await updateDoc(itemRef, { requestQty: Number(qty) });
  loadInventoryForProcurement(user.uid);
};

