const STORAGE_KEY = "readingLifeBoard.v1";

const categories = [
  "最喜欢", "最失望", "最意外", "最悲伤", "影响最大",
  "第一本读", "最近一本读", "最喜欢角色", "最喜欢作者", "最喜欢剧情",
  "最喜欢结局", "最喜欢文笔", "最喜欢系列", "读最久", "读最快",
  "读最多次", "反复放弃", "最被低估", "最被高估", "最想忘记"
];

const grid = document.querySelector("#card-grid");
const dialog = document.querySelector("#edit-dialog");
const form = document.querySelector("#edit-form");
const titleInput = document.querySelector("#book-title");
const authorInput = document.querySelector("#book-author");
const noteInput = document.querySelector("#book-note");
const imageInput = document.querySelector("#book-image");
const imagePreview = document.querySelector("#image-preview");
const removeImageButton = document.querySelector("#remove-image");

let currentIndex = null;
let pendingImage = null;
let records = loadRecords();

function emptyRecord(category) {
  return { category, title: "", author: "", note: "", image: "" };
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      // Preserve saved records by category when the card list changes.
      const byCategory = new Map(saved.map(item => [item.category, item]));
      return categories.map(category => ({ ...emptyRecord(category), ...(byCategory.get(category) || {}) }));
    }
  } catch (error) {
    console.warn("无法读取本地阅读记录：", error);
  }
  return categories.map(emptyRecord);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    alert("保存失败。可能是图片过大导致浏览器存储空间不足，请换用较小的图片，或导出备份后重新尝试。");
  }
}

function renderCards() {
  grid.innerHTML = "";
  records.forEach((record, index) => {
    const button = document.createElement("button");
    button.className = "reading-card";
    button.type = "button";
    button.setAttribute("aria-label", `编辑：${record.category}`);

    const cover = document.createElement("span");
    cover.className = "cover" + (record.image ? " has-image" : "");

    if (record.image) {
      const img = document.createElement("img");
      img.src = record.image;
      img.alt = record.title ? `${record.title}的封面` : "书籍封面";
      cover.appendChild(img);
    } else {
      const plus = document.createElement("span");
      plus.className = "plus";
      plus.textContent = record.title || record.author ? "" : "+";
      cover.appendChild(plus);
    }

    // 书名和作者显示在图片区域内；无图片时也显示文字。
    if (record.title || record.author) {
      const info = document.createElement("span");
      info.className = "book-info" + (record.image ? " on-image" : " no-image-info");

      if (record.title) {
        const title = document.createElement("span");
        title.className = "book-title";
        title.textContent = record.title;
        info.appendChild(title);
      }
      if (record.author) {
        const author = document.createElement("span");
        author.className = "book-author";
        author.textContent = record.author;
        info.appendChild(author);
      }
      cover.appendChild(info);
    }

    // 分类描述固定显示，不受书名或作者输入影响。
    const label = document.createElement("span");
    label.className = "card-title";
    label.textContent = record.category;

    button.append(cover, label);
    button.addEventListener("click", () => openEditor(index));
    grid.appendChild(button);
  });
}

function openEditor(index) {
  currentIndex = index;
  const record = records[index];
  document.querySelector("#dialog-title").textContent = record.category;
  titleInput.value = record.title;
  authorInput.value = record.author;
  noteInput.value = record.note;
  imageInput.value = "";
  pendingImage = record.image || null;
  updatePreview();
  dialog.showModal();
}

function updatePreview() {
  if (pendingImage) {
    imagePreview.src = pendingImage;
    imagePreview.hidden = false;
  } else {
    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;
  }
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files && imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("请选择图片文件。");
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const source = new Image();
    source.onload = () => {
      const maxSide = 700;
      const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      pendingImage = canvas.toDataURL("image/jpeg", 0.82);
      updatePreview();
    };
    source.onerror = () => alert("这张图片无法读取，请换一张图片。");
    source.src = reader.result;
  };
  reader.readAsDataURL(file);
});

removeImageButton.addEventListener("click", () => {
  pendingImage = null;
  imageInput.value = "";
  updatePreview();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (currentIndex === null) return;
  records[currentIndex] = {
    ...records[currentIndex],
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    note: noteInput.value.trim(),
    image: pendingImage || ""
  };
  persist();
  renderCards();
  dialog.close();
});

document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());

document.querySelector("#delete-card").addEventListener("click", () => {
  if (currentIndex === null) return;
  records[currentIndex] = emptyRecord(categories[currentIndex]);
  persist();
  renderCards();
  dialog.close();
});

document.querySelector("#export-btn").addEventListener("click", () => {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    title: document.querySelector("h1").textContent,
    author: document.querySelector(".author span").textContent,
    records
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reading-life-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (!Array.isArray(backup.records)) throw new Error("备份文件中没有找到阅读记录。");
    const byCategory = new Map(backup.records.map(item => [item.category, item]));
    records = categories.map(category => ({ ...emptyRecord(category), ...(byCategory.get(category) || {}) }));
    if (backup.title) document.querySelector("h1").textContent = backup.title;
    if (backup.author) document.querySelector(".author span").textContent = backup.author;
    persist();
    renderCards();
    alert("导入成功。");
  } catch (error) {
    alert(`导入失败：${error.message}`);
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#reset-btn").addEventListener("click", () => {
  if (!confirm("确定清空全部阅读记录吗？建议先导出备份。")) return;
  records = categories.map(emptyRecord);
  persist();
  renderCards();
});

document.querySelector("h1").addEventListener("input", () => {
  document.title = document.querySelector("h1").textContent.trim() || "个人生涯阅读档案表";
});
document.querySelector(".author span").addEventListener("input", () => {});

renderCards();
// 保存阅读档案为图片
async function saveAsImage() {
    const sheet = document.querySelector('.sheet');

    if (!sheet) {
        alert('找不到阅读档案区域！');
        return;
    }

    // 检查 html2canvas 是否加载成功
    if (typeof html2canvas === 'undefined') {
        alert('图片保存工具加载失败，请检查网络连接后重试。');
        return;
    }

    try {
        const canvas = await html2canvas(sheet, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            onclone: function(clonedDocument) {
                // 截图时隐藏底部按钮
                const footer = clonedDocument.querySelector('.sheet footer');
                if (footer) {
                    footer.style.display = 'none';
                }
            }
        });

        // 将画布转换成 PNG 图片
        canvas.toBlob(function(blob) {
            if (!blob) {
                alert('图片生成失败，请重试。');
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = '个人生涯阅读档案表.png';
            link.click();

            URL.revokeObjectURL(url);
        }, 'image/png');

    } catch (error) {
        console.error('保存图片失败：', error);
        alert('保存图片失败，请打开浏览器控制台查看错误信息。');
    }
}