import socket
import time

def is_uvicorn_running(host="127.0.0.1", port=8000):
    """Überprüft, ob Uvicorn auf dem angegebenen Host und Port läuft."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((host, port))
        s.shutdown(socket.SHUT_RDWR)
        return True
    except ConnectionRefusedError:
        return False
    finally:
        s.close()

if __name__ == "__main__":
    while not is_uvicorn_running():
        print("Uvicorn startet noch...")
        time.sleep(1)
    print("Uvicorn ist gestartet!")
    