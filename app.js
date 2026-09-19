import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.GIFT_APP_CONFIG || {};
const configured = config.supabaseUrl?.startsWith('https://') && !config.supabaseUrl.includes('YOUR_') && config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_');
const supabase = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const grid = document.querySelector('#gift-grid');
const template = document.querySelector('#gift-template');
const modal = document.querySelector('#gift-modal');
const ownerModal = document.querySelector('#owner-modal');
let selectedImage = null;
let gifts = [];

function hostName(link) { try { return new URL(link).hostname.replace('www.', ''); } catch { return 'cadeau link'; } }
function linkPreview(link) { return `https://image.thum.io/get/width/900/crop/700/noanimate/${encodeURIComponent(link)}`; }
function showError(message) { document.querySelector('#owner-error').textContent = message; }
function resetGiftForm() { document.querySelector('#gift-form').reset(); selectedImage = null; document.querySelector('#preview-wrap').hidden = true; }

function render() {
  grid.replaceChildren();
  gifts.forEach((gift, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.style.setProperty('--image-height', `${[260, 205, 315][index % 3]}px`);
    card.classList.toggle('is-claimed', gift.claimed);
    const image = card.querySelector('.card-image');
    image.src = gift.image_path || linkPreview(gift.link);
    image.alt = gift.title;
    image.addEventListener('error', () => image.removeAttribute('src'));
    card.querySelector('.card-image-link').href = gift.link;
    card.querySelector('.gift-title').textContent = gift.title;
    card.querySelector('.source-label').textContent = hostName(gift.link);
    card.querySelector('.visit-link').href = gift.link;
    const check = card.querySelector('input');
    check.checked = gift.claimed;
    check.addEventListener('change', async () => {
      check.disabled = true;
      const { error } = await supabase.rpc('set_gift_claimed', { gift_id: gift.id, is_claimed: check.checked });
      if (error) { check.checked = !check.checked; alert('Dat lukte niet. Probeer het nog eens.'); }
      else { loadGifts(); }
      check.disabled = false;
    });
    grid.append(card);
  });
  document.querySelector('#idea-count').textContent = `${gifts.length} ${gifts.length === 1 ? 'idee' : 'ideeën'}`;
  document.querySelector('#claimed-count').textContent = `${gifts.filter(gift => gift.claimed).length} uitgekozen`;
}

async function loadGifts() {
  const { data, error } = await supabase.from('gifts').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  gifts = data; render();
}

async function ownerSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function uploadCover(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('gift-images').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from('gift-images').getPublicUrl(path).data.publicUrl;
}

document.querySelector('#open-modal').addEventListener('click', async () => {
  if (!configured) { alert('Voeg eerst je Supabase projectgegevens toe aan config.js.'); return; }
  if (await ownerSession()) modal.showModal(); else ownerModal.showModal();
});
document.querySelector('#close-modal').onclick = () => { resetGiftForm(); modal.close(); };
document.querySelector('#owner-close').onclick = () => ownerModal.close();
document.querySelector('#owner-form').addEventListener('submit', async event => {
  event.preventDefault(); showError('');
  const email = document.querySelector('#owner-email').value;
  const password = document.querySelector('#owner-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { showError('Inloggen lukt niet. Controleer je e-mailadres en wachtwoord.'); return; }
  event.target.reset(); ownerModal.close(); modal.showModal();
});
document.querySelector('#gift-image').addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return;
  selectedImage = file;
  document.querySelector('#image-preview').src = URL.createObjectURL(file);
  document.querySelector('#preview-wrap').hidden = false;
});
document.querySelector('#remove-image').onclick = () => { selectedImage = null; document.querySelector('#gift-image').value = ''; document.querySelector('#preview-wrap').hidden = true; };
document.querySelector('#gift-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.submitter; submit.disabled = true; submit.textContent = 'Toevoegen…';
  try {
    const title = document.querySelector('#gift-title').value.trim();
    const link = document.querySelector('#gift-link').value.trim();
    const image_path = selectedImage ? await uploadCover(selectedImage) : null;
    const { error } = await supabase.from('gifts').insert({ title, link, image_path });
    if (error) throw error;
    resetGiftForm(); modal.close();
  } catch (error) { alert('Dit idee kon niet worden opgeslagen. Ben je ingelogd als eigenaar?'); console.error(error); }
  finally { submit.disabled = false; submit.innerHTML = 'Idee toevoegen <span>→</span>'; }
});

if (configured) {
  loadGifts();
  supabase.channel('gifts-live').on('postgres_changes', { event: '*', schema: 'public', table: 'gifts' }, loadGifts).subscribe();
} else {
  render();
}
