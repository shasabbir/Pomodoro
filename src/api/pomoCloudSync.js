const scriptUrl = "https://script.google.com/macros/s/AKfycbxo5WFvIso1_7WbUREeQUGhueeb1GGCA84DpiJ75OT9JjUrl-1YkVdqYSmDME52j4g4/exec";

/**
 * Get the list of content (returns an array of strings)
 * @param {function} onSuccess - called with the array of items
 * @param {function} onError - called with error message
 */
export function getContent(onSuccess, onError) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", `${scriptUrl}?action=get`, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          onSuccess && onSuccess(data);
        } catch (err) {
          onError && onError("Invalid JSON");
        }
      } else {
        onError && onError(xhr.statusText);
      }
    }
  };
  xhr.send();
}

/**
 * Add content (string)
 * @param {string} url
 * @param {function} onSuccess - called with success message
 * @param {function} onError - called with error message
 */
export function addContent(url, onSuccess, onError) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", `${scriptUrl}?action=add&url=${encodeURIComponent(url)}`, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        onSuccess && onSuccess(xhr.responseText);
      } else {
        onError && onError(xhr.statusText);
      }
    }
  };
  xhr.send();
}

/**
 * Delete content (string)
 * @param {string} url
 * @param {function} onSuccess - called with success message
 * @param {function} onError - called with error message
 */
export function deleteContent(url, onSuccess, onError) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", `${scriptUrl}?action=delete&url=${encodeURIComponent(url)}`, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        onSuccess && onSuccess(xhr.responseText);
      } else {
        onError && onError(xhr.statusText);
      }
    }
  };
  xhr.send();
}