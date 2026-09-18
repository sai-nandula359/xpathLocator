import type { AnchorElement, ElementSnapshot, StateAnchor } from "@/types";

export function makeSnapshot(overrides: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    tag: "div",
    text: "",
    innerText: "",
    outerHtml: "<div></div>",
    attributes: {},
    classList: [],
    parentTag: null,
    parentAttributes: null,
    siblingIndex: 0,
    siblingCount: 1,
    tagSiblingCount: 1,
    childTags: [],
    domDepth: 3,
    nearbyLabelText: null,
    ancestorChain: [
      { tag: "html", index: 1 },
      { tag: "body", index: 1 },
      { tag: "div", index: 1 },
    ],
    isSensitive: false,
    limitedContext: null,
    pageUrl: "https://example.com/login",
    pageTitle: "Example Login",
    labelAnchor: null,
    landmarkAncestor: null,
    siblingAnchors: { previous: null, next: null },
    stateAnchor: null,
    frameSrc: null,
    viewportWidth: 1280,
    viewportHeight: 800,
    ...overrides,
  };
}

const usernameLabel: AnchorElement = {
  tag: "label",
  text: "Username",
  attributes: { for: "username" },
  isUnique: true,
};
const formGroupDiv: AnchorElement = {
  tag: "div",
  text: "",
  attributes: { class: "form-group" },
  isUnique: true,
};

// The doc's own worked example (sections 12, 14, 20): a login button with a data-testid,
// an id, and visible text "Login".
export function loginButtonSnapshot(): ElementSnapshot {
  return makeSnapshot({
    tag: "button",
    text: "Login",
    innerText: "Login",
    outerHtml: `<button id="loginButton" data-testid="login-button" class="btn btn-primary" type="submit">Login</button>`,
    attributes: {
      id: "loginButton",
      "data-testid": "login-button",
      class: "btn btn-primary",
      type: "submit",
    },
    classList: ["btn", "btn-primary"],
    ancestorChain: [
      { tag: "html", index: 1 },
      { tag: "body", index: 1 },
      { tag: "div", index: 2 },
      { tag: "form", index: 1 },
      { tag: "div", index: 1 },
      { tag: "button", index: 1 },
    ],
  });
}

// The doc's username field example (section 14): reachable via name, a container class, a
// "Username" <label> sharing its parent (feeding parent:: and following::/sibling::), and a
// form-group landmark ancestor (feeding descendant::).
export function usernameInputSnapshot(): ElementSnapshot {
  return makeSnapshot({
    tag: "input",
    outerHtml: `<input name="username" class="input-container" type="text" placeholder="Username" />`,
    attributes: { name: "username", class: "input-container", type: "text", placeholder: "Username" },
    classList: ["input-container"],
    nearbyLabelText: "Username",
    parentTag: "div",
    parentAttributes: { class: "form-group" },
    labelAnchor: {
      element: usernameLabel,
      sharesParent: true,
      parentContains: true,
      documentOrder: "before",
    },
    landmarkAncestor: { element: formGroupDiv, depth: 0 },
    siblingAnchors: { previous: usernameLabel, next: null },
  });
}

// section 13's ancestor:: example: a <span> anchor (not sharing a parent with the input) inside
// a deeper form-group landmark: //span[...]/ancestor::div[contains(@class,'form-group')]//input
export function ancestorExampleSnapshot(): ElementSnapshot {
  const spanAnchor: AnchorElement = { tag: "span", text: "Username", attributes: {}, isUnique: true };
  return makeSnapshot({
    tag: "input",
    attributes: { name: "username" },
    labelAnchor: {
      element: spanAnchor,
      sharesParent: false,
      parentContains: true,
      documentOrder: "before",
    },
    landmarkAncestor: { element: formGroupDiv, depth: 2 },
  });
}

// A duplicated-widget scenario (a real production search-widget case): an input inside one of
// several structurally-identical `div[role='tabpanel']` copies (one per tab), distinguished only
// by the other copies carrying `hidden` — exactly what electron/webview-preload.cjs's
// resolveStateAnchor() detects and validates live at capture time.
export function tabbedWidgetStateAnchorSnapshot(): ElementSnapshot {
  const tabPanelAnchor: AnchorElement = {
    tag: "div",
    text: "",
    attributes: { role: "tabpanel" },
    isUnique: false, // matches every tab's panel on its own — that's the whole point
  };
  const stateAnchor: StateAnchor = { element: tabPanelAnchor, depth: 1, statePredicate: "not(@hidden)" };
  return makeSnapshot({
    tag: "input",
    attributes: { id: "location", name: "location" },
    parentTag: "div",
    stateAnchor,
  });
}

// section 13's child:: and descendant:: examples: an input inside //form[@id='loginForm'].
export function loginFormDescendantSnapshot(): ElementSnapshot {
  const loginForm: AnchorElement = { tag: "form", text: "", attributes: { id: "loginForm" }, isUnique: true };
  return makeSnapshot({
    tag: "input",
    attributes: { name: "username" },
    parentTag: "div",
    landmarkAncestor: { element: loginForm, depth: 1 },
    ancestorChain: [
      { tag: "html", index: 1 },
      { tag: "body", index: 1 },
      { tag: "form", index: 1 },
      { tag: "div", index: 1 },
      { tag: "input", index: 1 },
    ],
  });
}
