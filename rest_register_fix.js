document.addEventListener("DOMContentLoaded", () => {
    const createBtn = document.getElementById("createRestBtn");
    if (!createBtn) return;

    createBtn.addEventListener("click", async () => {
        const nameInput = document.getElementById("newRestName");
        if (!nameInput || !nameInput.value.trim()) {
            alert("Введите название ресторана");
            return;
        }

        const payload = {
            telegram_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "demo_id",
            name: nameInput.value.trim(),
            force_new: true
        };

        try {
            const res = await fetch(API_BASE + "/register_telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();
            console.log("Ресторан создан:", data);
            alert("✅ Ресторан создан! ID: " + data.restaurant_id);
            location.reload();
        } catch (err) {
            console.error(err);
            alert("Ошибка при создании ресторана: " + err.message);
        }
    });
});
