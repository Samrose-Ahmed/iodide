// we will spyOn / mock these file operations
import configureMockStore from "redux-mock-store";
import thunk from "redux-thunk";

import * as FILE_OPS from "../../../shared/utils/file-operations";

import { saveFile, loadFile, deleteFile } from "../file-request-actions";

const mockStore = configureMockStore([thunk]);

const initialState = () => {
  return {
    notebookInfo: {
      connectionMode: "SERVER",
      files: [
        {
          filename: "file1.csv",
          id: 0,
          lastUpdated: "2019-04-03T16:51:45.075609+00:00"
        },
        {
          filename: "file2.csv",
          id: 1,
          lastUpdated: "2019-04-01T14:51:00.075609+00:00"
        },
        {
          filename: "file3.csv",
          id: 2,
          lastUpdated: "2019-03-29T22:22:12.075609+00:00"
        }
      ]
    }
  };
};

jest.useFakeTimers();

describe("loadFile (editor action)", () => {
  let loadFileMock;
  let messagePasserMock;
  let store;

  beforeEach(() => {
    messagePasserMock = jest.fn();
    loadFileMock = jest.spyOn(FILE_OPS, "loadFileFromServer");
    loadFileMock.mockReset();
    store = mockStore(initialState());
  });

  it("fails if not enough arguments are passed in", () => {
    expect(() => store.dispatch(loadFile())).toThrowError();
    expect(() => store.dispatch(loadFile("file1.csv"))).toThrowError();
    expect(() =>
      store.dispatch(loadFile("file1.csv", "some-file-id"))
    ).toThrowError();

    expect(() =>
      store.dispatch(
        loadFile("file1.csv", "some-file-id", {
          fetchType: "text"
        })
      )
    ).toThrowError();
  });
  it("fails on invalid arguments (and messagePasser sends msg. to eval frame)", () => {
    store.dispatch(
      loadFile(
        "file1.csv",
        "some-file-id",
        {
          fetchType: "error"
        },
        messagePasserMock
      )
    );
    expect(messagePasserMock).toHaveBeenCalledTimes(1);
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_ERROR",
      {
        fileRequestID: "some-file-id",
        reason: `invalid fetch type "error"`
      }
    ]);
    messagePasserMock.mockReset();
  });

  it("sends message back to eval-frame signaling success when the return value of loadFile rejects (server returns error)", async () => {
    loadFileMock.mockImplementation(() => {
      return Promise.reject(new Error("artificial error"));
    });
    const request = store.dispatch(
      loadFile(
        "file1.csv",
        "file-request-id-0",
        { fetchType: "text" },
        messagePasserMock
      )
    );

    await expect(request).resolves.toBe(undefined);

    expect(loadFileMock).toHaveBeenCalledTimes(1);

    expect(store.getActions()).toEqual([]);

    expect(messagePasserMock).toHaveBeenCalledTimes(1);

    // check to see what message was sent back to the eval-frame.
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_ERROR",
      { fileRequestID: "file-request-id-0", reason: "artificial error" }
    ]);
  });

  it("sends message back to eval-frame signaling success when the return value of loadFile resolves (server returns success)", async () => {
    // set loadFileMock to resolve to mock a successful file upload
    loadFileMock.mockImplementation(() => {
      return Promise.resolve("loaded-file-contents");
    });

    const request = store.dispatch(
      loadFile(
        "file1.csv",
        "file-request-id-0",
        { fetchType: "text" },
        messagePasserMock
      )
    );

    jest.runAllTicks();

    await expect(request).resolves.toBe(undefined);

    expect(loadFileMock).toHaveBeenCalledTimes(1);

    expect(messagePasserMock).toHaveBeenCalledTimes(1);

    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_SUCCESS",
      {
        response: "loaded-file-contents",
        fileRequestID: "file-request-id-0"
      }
    ]);
  });
});

describe("saveFile (editor action)", () => {
  let saveFileMock;
  let messagePasserMock;
  let store;

  beforeEach(() => {
    messagePasserMock = jest.fn();
    saveFileMock = jest.spyOn(FILE_OPS, "saveFileToServer");
    saveFileMock.mockReset();
    store = mockStore(initialState());
  });

  it("fails if insufficient arguments go in", () => {
    expect(() => store.dispatch(saveFile())).toThrowError();
    expect(() => store.dispatch(saveFile("file1.csv"))).toThrowError();
    expect(() =>
      store.dispatch(saveFile("file1.csv", "some-file-request-id"))
    ).toThrowError();
  });
  it("fails if invalid arguments are passed (messagePasser sends message to eval frame)", () => {
    store.dispatch(
      saveFile(
        "file1.csv",
        "some-file-request-id",
        { overwrite: false },
        messagePasserMock
      )
    );
    expect(messagePasserMock).toHaveBeenCalledTimes(1);
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_ERROR",
      {
        fileRequestID: "some-file-request-id",
        reason: `save: file "file1.csv" already exists`
      }
    ]);
    messagePasserMock.mockReset();
  });

  it("returns error if there was a server error, passing the reason down to the eval frame", async () => {
    saveFileMock.mockImplementation(() => {
      return Promise.reject(new Error("artificial-error"));
    });

    const request = store.dispatch(
      saveFile(
        "new-data.csv",
        "file-request-id-0",
        { overwrite: true },
        messagePasserMock
      )
    );

    await expect(request).resolves.toBe(undefined);

    expect(saveFileMock).toHaveBeenCalledTimes(1);

    // test the relevant dispatches that occurred: ADD_FILE_TO_NOTEBOOK.
    expect(store.getActions()).toEqual([]);
    // the message passer was called, and what its value was.
    expect(messagePasserMock).toHaveBeenCalledTimes(1);
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_ERROR",
      { reason: "artificial-error", fileRequestID: "file-request-id-0" }
    ]);
  });

  it("successfully calls saveFileToServer & dispatches ADD_FILE_TO_NOTEBOOK", async () => {
    saveFileMock.mockImplementation(() => {
      return Promise.resolve({
        filename: "test.csv",
        id: 0,
        last_updated: "a-date-string"
      });
    });

    const request = store.dispatch(
      saveFile(
        "new-data.csv",
        "file-request-id-0",
        { overwrite: true },
        messagePasserMock
      )
    );

    await expect(request).resolves.toBe(undefined);

    expect(saveFileMock).toHaveBeenCalledTimes(1);

    expect(store.getActions()).toEqual([
      {
        type: "ADD_FILE_TO_NOTEBOOK",
        filename: "test.csv",
        lastUpdated: "a-date-string",
        fileID: 0
      }
    ]);
    expect(messagePasserMock).toHaveBeenCalledTimes(1);
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_SUCCESS",
      { response: undefined, fileRequestID: "file-request-id-0" }
    ]);
  });
});

describe("deleteFile (editor action)", () => {
  let deleteFileMock;
  let messagePasserMock;
  let store;

  beforeEach(() => {
    messagePasserMock = jest.fn();
    deleteFileMock = jest.spyOn(FILE_OPS, "deleteFileOnServer");
    deleteFileMock.mockReset();
    store = mockStore(initialState());
  });

  it("fails if insufficent arguments are passed in", () => {
    expect(() => store.dispatch(deleteFile())).toThrowError();
    expect(() => store.dispatch(deleteFile("test.csv"))).toThrowError();
    expect(() =>
      store.dispatch(deleteFile("test.csv", "some-id"))
    ).toThrowError();
    expect(() =>
      store.dispatch(deleteFile("test.csv", "some-id", undefined))
    ).toThrowError();
  });
  it("fails if invalid arguments are passed in", () => {
    // file file does not exist
    store.dispatch(
      deleteFile(
        "does-not-exist.csv",
        "some-file-request-id",
        undefined,
        messagePasserMock
      )
    );
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_ERROR",
      {
        fileRequestID: "some-file-request-id",
        reason: 'delete: file "does-not-exist.csv" does not exist'
      }
    ]);
  });

  it("successfully handles a server error on deleteFileFromServer and sends the appropriate message back to the eval frame", async () => {
    deleteFileMock.mockImplementation(() => {
      return Promise.reject(new Error("artificial error"));
    });

    const request = store.dispatch(
      deleteFile("file1.csv", "file-request-id-0", undefined, messagePasserMock)
    );

    await expect(request).resolves.toBe(undefined);
    expect(deleteFileMock).toHaveBeenCalledTimes(1);

    // test the relevant dispatches that occurred: DELETE_FILE_FROM_NOTEBOOK.
    expect(store.getActions()).toEqual([]);
    // the message passer was called, and what its value was.
    expect(messagePasserMock).toHaveBeenCalledTimes(1);
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_ERROR",
      { reason: "artificial error", fileRequestID: "file-request-id-0" }
    ]);
  });

  it("successfully calls deleteFileFromServer & dispatches DELETE_FILE_FROM_NOTEBOOK", async () => {
    deleteFileMock.mockImplementation(() => {
      return Promise.resolve(undefined);
    });

    const request = store.dispatch(
      deleteFile("file1.csv", "file-request-id-0", undefined, messagePasserMock)
    );

    await expect(request).resolves.toBe(undefined);
    expect(deleteFileMock).toHaveBeenCalled();

    expect(store.getActions()).toEqual([
      {
        fileID: 0,
        type: "DELETE_FILE_FROM_NOTEBOOK"
      }
    ]);
    // the message passer was called, and what its value was.
    expect(messagePasserMock).toHaveBeenCalledTimes(1);
    expect(messagePasserMock.mock.calls[0]).toEqual([
      "REQUESTED_FILE_OPERATION_SUCCESS",
      { response: undefined, fileRequestID: "file-request-id-0" }
    ]);
  });
});