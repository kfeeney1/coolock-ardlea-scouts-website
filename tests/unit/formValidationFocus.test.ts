import { afterEach, describe, expect, it, vi } from "vitest";
import { focusFirstInvalidField } from "../../src/services/formValidationFocus";

describe("focusFirstInvalidField", () => {
  afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

  it("focuses the first invalid control in document order and preserves later fields", () => {
    document.body.innerHTML = '<input id="first" aria-invalid="true"><input id="later" aria-invalid="true" value="kept">';
    const first = document.getElementById("first") as HTMLInputElement;
    const later = document.getElementById("later") as HTMLInputElement;
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue({ top: 160 } as DOMRect);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    expect(focusFirstInvalidField()).toBe(first);
    expect(document.activeElement).toBe(first);
    expect(later.value).toBe("kept");
    expect(scrollTo).toHaveBeenCalledWith({ top: 472, behavior: "smooth" });
  });

  it("focuses a control inside an invalid custom field container", () => {
    document.body.innerHTML = '<div data-validation-invalid="true"><input id="radio" type="radio"></div>';
    const input = document.getElementById("radio") as HTMLInputElement;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    expect(focusFirstInvalidField()).toBe(input);
    expect(document.activeElement).toBe(input);
  });
});
