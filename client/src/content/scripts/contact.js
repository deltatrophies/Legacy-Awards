const API_KEY = "9674b0ca033b4f2993529b9c0166f60b"; 

      const addressText = "B-14, Okhla Phase II, New Delhi, Delhi 110020";

      // Fixed Geoapify fetch URL
      fetch(
  `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressText)}&apiKey=${API_KEY}`
)
        .then((response) => response.json())
        .then((result) => {
          if (!result.features || !result.features.length) {
            console.error("No location found for this address");
            return;
          }

          const feature = result.features[0];
          const { lat, lon } = feature.properties;

          const map = L.map("map").setView([lat, lon], 16);

          // Fixed Geoapify tile layer URL and attribution HTML
          L.tileLayer(
  `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${API_KEY}`,
            {
              attribution: 'Powered by Geoapify | &copy; OpenStreetMap contributors',
            }
          ).addTo(map);

          L.marker([lat, lon]).addTo(map).bindPopup(`${addressText}`).openPopup();
        })
        .catch((error) => console.log("Geoapify error", error));

      function toggleQuantity() {
        const typeSelect = document.getElementById("inquiryType");
        const qtyGroup = document.getElementById("qtyGroup");
        if (typeSelect.value === "bulk" || typeSelect.value === "custom") {
          qtyGroup.style.display = "flex";
        } else {
          qtyGroup.style.display = "none";
        }
      }

      const contactForm = document.getElementById("contactForm");
      const contactStatus = document.getElementById("contactStatus");
      contactForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = contactForm.querySelector("button[type='submit']");
        button.disabled = true;
        button.textContent = "Sending inquiry...";
        contactStatus.textContent = "Uploading your brief securely...";
        try {
          const result = await window.LegacyAPI.submitInquiry(new FormData(contactForm));
          contactForm.reset();
          toggleQuantity();
          contactStatus.textContent = `Inquiry received. Your reference is ${result.reference}.`;
        } catch (error) {
          contactStatus.textContent = error.message || "We could not send your inquiry. Please try again.";
        } finally {
          button.disabled = false;
          button.textContent = "Send inquiry — get a quote";
        }
      });
