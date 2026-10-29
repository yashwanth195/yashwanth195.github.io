"use strict";

(() => {
  const systemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionToggle = document.getElementById("motion-toggle");
  let motionOverride = null;
  const reportStorageError = (error) => {
    if (!(error instanceof DOMException)) throw error;
    console.warn("The motion preference could not be saved or restored.", error);
    motionToggle.title = "Preference storage is blocked. Your motion choice applies until this page is reloaded.";
  };
  try {
    const savedMotion = window.localStorage.getItem("portfolio-motion");
    if (savedMotion === "on" || savedMotion === "off") motionOverride = savedMotion === "on";
  } catch (error) {
    reportStorageError(error);
  }
  const reducedMotion = {
    get matches() { return motionOverride === null ? systemMotion.matches : !motionOverride; }
  };
  const updateMotion = () => {
    const enabled = !reducedMotion.matches;
    document.documentElement.dataset.motion = enabled ? "on" : "off";
    motionToggle.setAttribute("aria-pressed", String(enabled));
    motionToggle.setAttribute("aria-label", enabled ? "Pause animations" : "Enable animations");
    motionToggle.querySelector("span").textContent = enabled ? "on" : "off";
    window.dispatchEvent(new Event("portfolio-motionchange"));
  };
  motionToggle.addEventListener("click", () => {
    motionOverride = reducedMotion.matches;
    try {
      window.localStorage.setItem("portfolio-motion", motionOverride ? "on" : "off");
    } catch (error) {
      reportStorageError(error);
    }
    updateMotion();
  });
  systemMotion.addEventListener("change", updateMotion);
  updateMotion();
  document.getElementById("year").textContent = String(new Date().getFullYear());

  const clickEffects = document.createElement("div");
  clickEffects.className = "click-effects";
  clickEffects.setAttribute("aria-hidden", "true");
  const hasPopover = typeof clickEffects.showPopover === "function";
  if (hasPopover) clickEffects.setAttribute("popover", "manual");
  document.body.append(clickEffects);
  const clearClickEffects = () => {
    clickEffects.replaceChildren();
    if (hasPopover && clickEffects.matches(":popover-open")) clickEffects.hidePopover();
  };
  document.addEventListener("click", (event) => {
    if (reducedMotion.matches || event.button !== 0 || !(event.target instanceof Element)) return;
    const control = event.target.closest("a, button, summary");
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
    if (control.closest(".project-card") || control.matches(".project-dialog .dialog-close")) return;
    const bounds = control.getBoundingClientRect();
    const x = event.detail === 0 ? bounds.left + bounds.width / 2 : event.clientX;
    const y = event.detail === 0 ? bounds.top + bounds.height / 2 : event.clientY;

    // A noninteractive top-layer surface keeps ripples visible above modal dialogs.
    if (hasPopover) {
      if (clickEffects.matches(":popover-open")) clickEffects.hidePopover();
      clickEffects.showPopover();
    } else {
      (document.querySelector("dialog[open]") || document.body).append(clickEffects);
    }
    const surface = clickEffects.getBoundingClientRect();
    const burst = document.createElement("div");
    burst.className = "click-burst";
    burst.style.left = `${x - surface.left}px`;
    burst.style.top = `${y - surface.top}px`;
    burst.style.setProperty("--ripple-ink", control.closest(".projects") ? "#60734c" : "#e1cfa0");
    burst.style.setProperty("--ripple-secondary", control.closest(".projects") ? "#426b84" : "#8cb8d9");
    const flare = document.createElement("span");
    flare.className = "click-flare";
    burst.append(flare);
    for (let index = 0; index < 3; index += 1) {
      const ring = document.createElement("span");
      ring.className = "click-ring";
      ring.style.animationDelay = `${index * 85}ms`;
      burst.append(ring);
    }
    for (const angle of [35, 125, 215, 305]) {
      const spark = document.createElement("span");
      spark.className = "click-spark";
      spark.style.setProperty("--spark-angle", `${angle}deg`);
      burst.append(spark);
    }
    burst.addEventListener("animationend", (animationEvent) => {
      if (animationEvent.target !== burst) return;
      burst.remove();
      if (!clickEffects.hasChildNodes() && hasPopover && clickEffects.matches(":popover-open")) {
        clickEffects.hidePopover();
      }
    });
    if (clickEffects.childElementCount >= 6) clickEffects.firstElementChild.remove();
    clickEffects.append(burst);
  });
  window.addEventListener("portfolio-motionchange", () => {
    if (reducedMotion.matches) clearClickEffects();
  });
  window.addEventListener("blur", clearClickEffects);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearClickEffects();
  });

  const closingDialogs = new WeakSet();
  let projectSession = null;
  let projectTransition = null;
  let detailOpening = false;
  const closeDialog = (dialog) => {
    if (!dialog.open || closingDialogs.has(dialog)) return;
    if (dialog.id === "detail-dialog" && projectSession && !reducedMotion.matches &&
        typeof document.startViewTransition === "function" && !projectTransition) {
      closeProjectDialog();
      return;
    }
    if (dialog.id === "detail-dialog" && projectTransition) projectTransition.skipTransition();
    if (reducedMotion.matches || typeof dialog.animate !== "function") {
      dialog.close();
      return;
    }
    closingDialogs.add(dialog);
    const animation = dialog.animate([
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(8px) scale(.985)" }
    ], { duration: 180, easing: "ease-in", fill: "forwards" });
    const finish = () => {
      dialog.close();
      closingDialogs.delete(dialog);
      animation.oncancel = null;
      animation.cancel();
    };
    animation.onfinish = finish;
    animation.oncancel = finish;
  };
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
  });
  document.querySelector(".wordmark").addEventListener("click", () => {
    if (reducedMotion.matches) return;
    document.querySelectorAll(".logo-strokes").forEach((strokes) => {
      if (typeof strokes.animate !== "function") return;
      strokes.animate([
        { strokeDashoffset: 120, opacity: 0.4 },
        { strokeDashoffset: 0, opacity: 1 }
      ], { duration: 1000, easing: "cubic-bezier(.16,1,.3,1)" });
    });
  });
  const contactDialog = document.getElementById("contact-dialog");
  const contactStatus = document.getElementById("contact-status");
  const contactAddress = document.getElementById("contact-address");
  if (typeof contactDialog.showModal === "function") {
    document.querySelectorAll("[data-contact-dialog]").forEach((link) => {
      link.setAttribute("aria-haspopup", "dialog");
      link.setAttribute("aria-controls", "contact-dialog");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        contactStatus.textContent = "";
        link.focus({ preventScroll: true });
        contactDialog.showModal();
      });
    });
    document.querySelector(".dialog-close").addEventListener("click", () => closeDialog(contactDialog));
    contactDialog.addEventListener("click", (event) => {
      if (event.target !== contactDialog) return;
      const bounds = contactDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        closeDialog(contactDialog);
      }
    });
  }
  document.getElementById("copy-email").addEventListener("click", async () => {
    const selectAddress = () => {
      contactAddress.focus();
      contactAddress.select();
      contactStatus.textContent = "Automatic copying is unavailable. The address is selected; use your device’s Copy command.";
    };
    if (!navigator.clipboard?.writeText) {
      selectAddress();
      return;
    }
    try {
      await navigator.clipboard.writeText(contactAddress.value);
      contactStatus.textContent = "Email address copied.";
    } catch (error) {
      console.warn("Clipboard access failed while copying the contact email.", error);
      selectAddress();
    }
  });

  const detailDialog = document.getElementById("detail-dialog");
  const detailContent = document.getElementById("detail-content");
  const detailVisual = document.getElementById("detail-visual");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const resetProjectMotion = [];
  document.querySelectorAll(".project-card").forEach((card) => {
    let pending = null;
    let position = null;
    const reset = () => {
      if (pending !== null) window.cancelAnimationFrame(pending);
      pending = null;
      position = null;
      card.classList.remove("is-tracking");
      for (const property of ["--tilt-x", "--tilt-y", "--light-x", "--light-y", "--light-opacity"]) {
        card.style.removeProperty(property);
      }
    };
    resetProjectMotion.push(reset);
    card.addEventListener("pointermove", (event) => {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === "touch") return;
      position = { x: event.clientX, y: event.clientY };
      if (pending !== null) return;
      pending = window.requestAnimationFrame(() => {
        pending = null;
        const bounds = card.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (position.x - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (position.y - bounds.top) / bounds.height));
        card.classList.add("is-tracking");
        card.style.setProperty("--tilt-x", `${(0.5 - y) * 8}deg`);
        card.style.setProperty("--tilt-y", `${(x - 0.5) * 12}deg`);
        card.style.setProperty("--light-x", `${x * 100}%`);
        card.style.setProperty("--light-y", `${y * 100}%`);
        card.style.setProperty("--light-opacity", "1");
      });
    }, { passive: true });
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
  });
  const resetAllProjectMotion = () => resetProjectMotion.forEach((reset) => reset());
  window.addEventListener("portfolio-motionchange", resetAllProjectMotion);
  finePointer.addEventListener("change", resetAllProjectMotion);
  window.addEventListener("blur", resetAllProjectMotion);

  const trackProjectTransition = (transition, source, artwork) => {
    projectTransition = transition;
    const finish = () => {
      if (projectTransition !== transition) return;
      source.style.removeProperty("view-transition-name");
      artwork()?.style.removeProperty("view-transition-name");
      projectTransition = null;
      detailOpening = false;
      closingDialogs.delete(detailDialog);
    };
    transition.ready.then(undefined, (error) => {
      if (error.name !== "AbortError") console.warn("The project artwork transition was skipped.", error);
    });
    transition.finished.then(finish, (error) => {
      console.error("The project view transition could not complete.", error);
      finish();
    });
  };
  function closeProjectDialog() {
    const source = projectSession.source;
    const artwork = detailVisual.firstElementChild;
    closingDialogs.add(detailDialog);
    clearClickEffects();
    artwork.style.viewTransitionName = "project-art";
    const transition = document.startViewTransition(() => {
      artwork.style.viewTransitionName = "none";
      source.style.viewTransitionName = "project-art";
      detailDialog.close();
    });
    trackProjectTransition(transition, source, () => artwork);
  }
  detailDialog.addEventListener("close", () => {
    projectSession = null;
    detailOpening = false;
  });
  window.addEventListener("portfolio-motionchange", () => {
    if (reducedMotion.matches && projectTransition) projectTransition.skipTransition();
  });
  const detailData = [
    {
      selector: ".experience",
      entries: [
        {
          title: "Microsoft",
          category: "SOFTWARE ENGINEER / DEC 2025 — PRESENT",
          intro: "OneDrive & SharePoint. Focused on build infrastructure, developer tooling, and web performance.",
          points: [
            "Modernizing JavaScript build workflows using Rust-based bundlers, native plugins, and loaders.",
            "Building cross-platform CI/CD for native tooling and automated dependency updates.",
            "Using AI coding agents for iterative implementation and output-parity validation.",
            "Contributing build-tooling improvements to the open-source Rush Stack ecosystem."
          ],
          links: [{ label: "Explore Microsoft’s Rush Stack", href: "https://github.com/microsoft/rushstack" }]
        },
        {
          title: "OLA",
          category: "SOFTWARE DEVELOPMENT ENGINEER / JUN 2022 — JUL 2023",
          intro: "Cloud infrastructure, streaming systems, and service reliability.",
          points: [
            "Operating Kubernetes clusters, managing application deployments, and improving rollback workflows.",
            "Working with AWS infrastructure including EKS, EC2, and S3.",
            "Managing Kafka and Flink infrastructure for real-time data processing.",
            "Building observability with Prometheus, Grafana, and Alertmanager."
          ]
        },
        {
          title: "Strand Life Sciences",
          category: "SOFTWARE DEVELOPMENT INTERN / MAY 2021 — JUL 2021",
          intro: "Making application logs and API behavior easier to investigate.",
          points: [
            "Improving the application logging framework with Log4j.",
            "Creating interactive dashboards for log analysis and API call tracking.",
            "Visualizing Elasticsearch data using Kibana and Logstash."
          ]
        }
      ]
    },
    {
      selector: ".project-card",
      entries: [
        {
          title: "Hybrid Text Summarization",
          category: "PROJECT / MACHINE LEARNING & NLP",
          intro: "Combining extractive and abstractive summarization to preserve context while making long-form information easier to consume.",
          points: [
            "Combines T5 and PEGASUS with feature optimization.",
            "Focuses on readability, coherence, and contextual understanding.",
            "Uses Python, C++, and NLP tooling."
          ],
          links: [{ label: "Project on GitHub", href: "https://github.com/yashwanth195/Hybrid-Text-Summarizer" }]
        },
        {
          title: "Blockchain-Based Voting",
          category: "PROJECT / DISTRIBUTED SYSTEMS",
          intro: "An exploration of decentralized vote validation and tabulation using a peer-to-peer blockchain.",
          points: [
            "Uses public-key encryption, smart contracts, and proof-of-work consensus.",
            "Built with Python, Django, Flask, and PostgreSQL.",
            "Includes pytest-based testing."
          ],
          links: [{ label: "Project on GitHub", href: "https://github.com/yashwanth195/blockchain-voting-1" }]
        },
        {
          title: "Group Signatures",
          category: "PROJECT / PRIVACY & CRYPTOGRAPHY",
          intro: "Exploring anonymous transactions while retaining membership management and accountability.",
          points: [
            "Includes certificate authority, membership revocation, and key management.",
            "Uses asymmetric and symmetric encryption with SHA-256 hashing.",
            "Supports selective identity revelation without exposing every participant."
          ]
        }
      ]
    },
    {
      selector: ".education-card",
      entries: [
        {
          title: "George Mason University",
          category: "GRADUATE STUDIES / AUG 2023 — MAY 2025",
          intro: "Master of Science in Computer Science.",
          points: ["Academic Excellence Award."],
          links: [{ label: "Visit George Mason University", href: "https://www.gmu.edu/" }]
        },
        {
          title: "National Institute of Technology Karnataka",
          category: "UNDERGRADUATE STUDIES / JUN 2018 — MAY 2022",
          intro: "Bachelor of Technology in Computer Science and Engineering.",
          points: ["Merit-based undergraduate scholarship."],
          links: [{ label: "Visit NIT Karnataka", href: "https://www.nitk.ac.in/" }]
        }
      ]
    }
  ];
  if (typeof detailDialog.showModal === "function") {
    for (const group of detailData) {
      document.querySelectorAll(group.selector).forEach((card, index) => {
        const detail = group.entries[index];
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "card-action";
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-controls", "detail-dialog");
        trigger.setAttribute("aria-label", `Explore ${detail.title}`);
        trigger.append("VIEW DETAILS ");
        const arrow = document.createElement("span");
        arrow.textContent = "↗";
        arrow.setAttribute("aria-hidden", "true");
        trigger.append(arrow);
        const target = card.querySelector(".experience-content, .wide-copy") || card;
        target.append(trigger);
        trigger.addEventListener("click", () => {
          if (detailDialog.open || detailOpening || projectTransition) return;
          trigger.focus({ preventScroll: true });
          const source = card.querySelector(".project-visual");
          const open = () => {
            detailDialog.classList.toggle("project-dialog", Boolean(source));
            detailVisual.hidden = !source;
            detailVisual.replaceChildren();
            if (source) {
              const artwork = source.cloneNode(true);
              artwork.style.removeProperty("view-transition-name");
              detailVisual.append(artwork);
              projectSession = { source };
            }
            document.getElementById("detail-title").textContent = detail.title;
            document.getElementById("detail-category").textContent = detail.category;
            const intro = document.createElement("p");
            intro.textContent = detail.intro;
            const list = document.createElement("ul");
            for (const point of detail.points) {
              const item = document.createElement("li");
              item.textContent = point;
              list.append(item);
            }
            detailContent.replaceChildren(intro, list);
            if (detail.links?.length) {
              const links = document.createElement("div");
              links.className = "detail-links";
              for (const link of detail.links) {
                const anchor = document.createElement("a");
                anchor.textContent = `${link.label} ↗`;
                anchor.href = link.href;
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
                links.append(anchor);
              }
              detailContent.append(links);
            }
            detailDialog.showModal();
            detailDialog.scrollTop = 0;
            detailOpening = false;
          };
          const bounds = source?.getBoundingClientRect();
          const sourceVisible = bounds && bounds.bottom > 0 && bounds.top < window.innerHeight;
          if (source && sourceVisible && !reducedMotion.matches && typeof document.startViewTransition === "function") {
            detailOpening = true;
            clearClickEffects();
            source.style.viewTransitionName = "project-art";
            const transition = document.startViewTransition(() => {
              source.style.viewTransitionName = "none";
              open();
              detailVisual.firstElementChild.style.viewTransitionName = "project-art";
            });
            trackProjectTransition(transition, source, () => detailVisual.firstElementChild);
          } else {
            open();
          }
        });
      });
    }
    detailDialog.querySelector(".dialog-close").addEventListener("click", () => closeDialog(detailDialog));
    detailDialog.addEventListener("click", (event) => {
      if (event.target !== detailDialog) return;
      const bounds = detailDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        closeDialog(detailDialog);
      }
    });
  }
  const documentation = {
    RUST: "https://doc.rust-lang.org/book/",
    TYPESCRIPT: "https://www.typescriptlang.org/docs/",
    RSPACK: "https://rspack.dev/",
    "AZURE DEVOPS": "https://learn.microsoft.com/en-us/azure/devops/",
    KUBERNETES: "https://kubernetes.io/docs/",
    AWS: "https://docs.aws.amazon.com/",
    KAFKA: "https://kafka.apache.org/documentation/",
    GRAFANA: "https://grafana.com/docs/",
    ELASTICSEARCH: "https://www.elastic.co/docs/reference/elasticsearch/",
    KIBANA: "https://www.elastic.co/docs/explore-analyze/",
    LOG4J: "https://logging.apache.org/log4j/2.x/"
  };
  document.querySelectorAll(".tags span").forEach((tag) => {
    const anchor = document.createElement("a");
    anchor.textContent = tag.textContent;
    anchor.href = documentation[tag.textContent];
    anchor.setAttribute("aria-label", `Read ${tag.textContent} documentation`);
    tag.replaceWith(anchor);
  });
  document.querySelectorAll('a[href^="https://"]').forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    document.documentElement.classList.add("motion-ready");
  }

  const progress = document.querySelector(".scroll-progress");
  const sectionLinks = [...document.querySelectorAll('nav a[href^="#"]')].map((link) => ({
    link, section: document.querySelector(link.getAttribute("href"))
  }));
  let scrollPending = false;
  const updateProgress = () => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0})`;
    const current = sectionLinks.filter(({ section }) => section.getBoundingClientRect().top <= window.innerHeight * 0.4).at(-1);
    for (const entry of sectionLinks) {
      if (entry === current) entry.link.setAttribute("aria-current", "location");
      else entry.link.removeAttribute("aria-current");
    }
    scrollPending = false;
  };
  window.addEventListener("scroll", () => {
    if (!scrollPending) {
      scrollPending = true;
      window.requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  updateProgress();

  const canvas = document.getElementById("sculpture");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power" });
  const artLabel = document.querySelector(".art-interaction");
  const showArtError = (reason) => {
    console.error(`The decorative sculpture is unavailable: ${reason}`);
    canvas.hidden = true;
    artLabel.textContent = "INTERACTIVE ART UNAVAILABLE ON THIS DEVICE";
  };
  if (!gl) {
    showArtError("WebGL is not supported or is disabled.");
    return;
  }

  const chapter = document.querySelector(".intro-chapter");
  const scene = { target: 0, progress: 0, dirty: true };
  const pointer = { x: 0, y: 0 };
  const rotation = { x: 0, y: 0 };
  let width = 0;
  let height = 0;
  let frame = null;
  let visible = true;
  let elapsed = 0;
  let previousTime = null;
  let lastPaint = -Infinity;
  let contextLost = false;
  let gpu = null;
  const vertices = [];
  const indices = [];
  const TAU = Math.PI * 2;
  const segments = 192;
  const sides = 40;
  const normalize = (v) => {
    const length = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  };
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  const centerline = (t) => {
    const radius = 1.2 + 0.4 * Math.cos(3 * t);
    return { x: radius * Math.cos(2 * t), y: radius * Math.sin(2 * t), z: 0.56 * Math.sin(3 * t) };
  };

  // Sweep a closed tube along the knot; interpolate normals on the GPU.
  for (let ring = 0; ring < segments; ring += 1) {
    const t = (ring / segments) * TAU;
    const center = centerline(t);
    const next = centerline(t + 0.001);
    const tangent = normalize({ x: next.x - center.x, y: next.y - center.y, z: next.z - center.z });
    const normal = normalize(cross(tangent, { x: 0, y: 0, z: 1 }));
    const binormal = normalize(cross(tangent, normal));
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * TAU;
      const nx = normal.x * Math.cos(angle) + binormal.x * Math.sin(angle);
      const ny = normal.y * Math.cos(angle) + binormal.y * Math.sin(angle);
      const nz = normal.z * Math.cos(angle) + binormal.z * Math.sin(angle);
      vertices.push(center.x + nx * 0.24, center.y + ny * 0.24, center.z + nz * 0.24, nx, ny, nz);
      const a = ring * sides + side;
      const b = ring * sides + (side + 1) % sides;
      const c = ((ring + 1) % segments) * sides + (side + 1) % sides;
      const d = ((ring + 1) % segments) * sides + side;
      indices.push(a, b, c, a, c, d);
    }
  }

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform vec2 uResolution;
    uniform vec2 uRotation;
    uniform float uScale;
    uniform float uLift;
    varying vec3 vNormal;
    varying vec3 vPosition;
    vec3 rotate(vec3 p) {
      float cy = cos(uRotation.y), sy = sin(uRotation.y);
      float cx = cos(uRotation.x), sx = sin(uRotation.x);
      vec3 q = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
      return vec3(q.x, q.y * cx - q.z * sx, q.y * sx + q.z * cx);
    }
    void main() {
      vec3 p = rotate(aPosition);
      vPosition = p;
      vNormal = rotate(aNormal);
      float perspective = 6.0 / (6.0 + p.z);
      vec2 clip = p.xy * uScale * perspective / uResolution * 2.0;
      gl_Position = vec4(clip.x, -clip.y + 0.08 + uLift, p.z / 6.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform float uStory;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 view = normalize(vec3(0.0, 0.0, -6.0) - vPosition);
      vec3 key = normalize(mix(vec3(-0.6, -0.8, -1.0), vec3(0.7, -0.4, -1.0), uStory));
      vec3 fill = normalize(vec3(0.9, 0.2, -0.6));
      float diffuse = max(dot(n, key), 0.0);
      float specular = pow(max(dot(n, normalize(key + view)), 0.0), 65.0);
      float edge = pow(max(dot(n, normalize(fill + view)), 0.0), 80.0);
      vec3 reflection = reflect(-view, n);
      float softbox = smoothstep(0.65, 0.9, reflection.y) * 0.6;
      float strip = pow(max(0.0, 1.0 - abs(reflection.x + 0.35)), 50.0) * 0.35;
      float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.0);
      vec3 color = vec3(0.085, 0.10, 0.078);
      color += mix(vec3(0.64, 0.57, 0.40), vec3(0.47, 0.61, 0.68), uStory * 0.65) * (diffuse * 0.62 + softbox + strip);
      color += vec3(1.0, 0.94, 0.78) * (specular * 0.85 + edge * 0.8);
      color += mix(vec3(0.42, 0.44, 0.34), vec3(0.34, 0.58, 0.75), uStory) * fresnel * 0.35;
      color = pow(color, vec3(0.8));
      gl_FragColor = vec4(color, 1.0);
    }
  `;
  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) {
      showArtError("A graphics shader could not be allocated.");
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      showArtError(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const initialize = () => {
    const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return false;
    }
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      showArtError("A graphics program could not be allocated.");
      return false;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      showArtError(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return false;
    }
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !indexBuffer) {
      showArtError("Graphics geometry could not be allocated.");
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
      return false;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    const normal = gl.getAttribLocation(program, "aNormal");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(normal);
    gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gpu = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      scale: gl.getUniformLocation(program, "uScale"),
      lift: gl.getUniformLocation(program, "uLift"),
      story: gl.getUniformLocation(program, "uStory"),
      rotation: gl.getUniformLocation(program, "uRotation")
    };
    return true;
  };
  if (!initialize()) return;

  const draw = (time) => {
    frame = null;
    if (!width || !height || !visible || document.hidden || contextLost) return;
    if (!reducedMotion.matches && time - lastPaint < 32) {
      frame = window.requestAnimationFrame(draw);
      return;
    }
    lastPaint = time;
    if (scene.dirty) {
      const bounds = chapter.getBoundingClientRect();
      scene.target = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - window.innerHeight)));
      const phase = scene.target < 0.3 ? "01 / COMPLEXITY INTO CLARITY" :
        scene.target < 0.7 ? "02 / PRECISION IN MOTION" : "03 / ENGINEERING, CONSIDERED";
      artLabel.textContent = phase;
      scene.dirty = false;
    }
    scene.progress += (scene.target - scene.progress) * 0.09;
    if (previousTime !== null && !reducedMotion.matches) elapsed += Math.min(time - previousTime, 64);
    previousTime = time;
    rotation.x += (pointer.x - rotation.x) * 0.045;
    rotation.y += (pointer.y - rotation.y) * 0.045;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(gpu.resolution, width, height);
    gl.uniform1f(gpu.scale, Math.min(width, height) * 0.23 * (1 - scene.progress * 0.15));
    gl.uniform2f(gpu.rotation, -0.65 + rotation.y * 0.22 + scene.progress * 0.6,
      elapsed * 0.00006 + 0.6 + rotation.x * 0.24 + scene.progress * 2.7);
    gl.uniform1f(gpu.lift, reducedMotion.matches ? 0 : Math.sin(elapsed * 0.0007) * 0.025 + scene.progress * 0.07);
    gl.uniform1f(gpu.story, scene.progress);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
  };
  const schedule = () => {
    if (frame === null && visible && !document.hidden && !contextLost) {
      previousTime = null;
      frame = window.requestAnimationFrame(draw);
    }
  };
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    scene.dirty = true;
    width = bounds.width;
    height = bounds.height;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    gl.viewport(0, 0, canvas.width, canvas.height);
    lastPaint = -Infinity;
    schedule();
  };
  chapter.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || event.pointerType === "touch") return;
    const bounds = chapter.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  }, { passive: true });
  chapter.addEventListener("pointerleave", () => {
    pointer.x = 0;
    pointer.y = 0;
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
        previousTime = null;
      }
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    } else schedule();
  });
  window.addEventListener("portfolio-motionchange", () => {
    pointer.x = pointer.y = rotation.x = rotation.y = 0;
    scene.dirty = true;
    if (reducedMotion.matches) scene.target = scene.progress = 0;
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    schedule();
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    console.error("The decorative sculpture paused because the WebGL context was lost.");
    artLabel.textContent = "INTERACTIVE ART PAUSED";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = !initialize();
    if (!contextLost) {
      canvas.hidden = false;
      scene.dirty = true;
      resize();
    }
  });
  window.addEventListener("scroll", () => {
    scene.dirty = true;
    schedule();
  }, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  resize();
})();
