"""
Hardware Detection Script — Zero-Trust Redactor Pro
Checks RAM and GPU specs to determine if Deep AI mode (Ollama/Llama 4) is viable.
Returns a JSON-serialisable profile consumed by server.py at startup.
"""

import subprocess
import platform
import json


def _get_ram_gb() -> float:
    """Return total system RAM in GB. Falls back to 0 on failure."""
    try:
        import psutil
        return round(psutil.virtual_memory().total / (1024 ** 3), 1)
    except ImportError:
        pass

    # Fallback without psutil
    system = platform.system()
    try:
        if system == "Windows":
            out = subprocess.check_output(
                ["wmic", "ComputerSystem", "get", "TotalPhysicalMemory"],
                stderr=subprocess.DEVNULL
            ).decode()
            for line in out.splitlines():
                line = line.strip()
                if line.isdigit():
                    return round(int(line) / (1024 ** 3), 1)
        elif system == "Linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        kb = int(line.split()[1])
                        return round(kb / (1024 ** 2), 1)
        elif system == "Darwin":
            out = subprocess.check_output(
                ["sysctl", "-n", "hw.memsize"],
                stderr=subprocess.DEVNULL
            ).decode().strip()
            return round(int(out) / (1024 ** 3), 1)
    except Exception:
        pass

    return 0.0


def _get_gpu_info() -> dict:
    """
    Detect the primary GPU.
    Returns { name, vendor, has_dedicated_gpu }.
    'Dedicated' means NVIDIA or AMD — Intel HD/UHD/Iris are treated as integrated.
    """
    name = "Unknown"
    vendor = "unknown"
    system = platform.system()

    try:
        if system == "Windows":
            out = subprocess.check_output(
                ["wmic", "path", "win32_videocontroller", "get", "name"],
                stderr=subprocess.DEVNULL
            ).decode()
            gpus = [
                line.strip() for line in out.splitlines()
                if line.strip() and line.strip().lower() != "name"
            ]
            if gpus:
                # Prefer NVIDIA/AMD if multiple adapters exist (skip Microsoft Basic)
                for g in gpus:
                    g_lower = g.lower()
                    if "nvidia" in g_lower or "geforce" in g_lower or "quadro" in g_lower:
                        name = g
                        vendor = "nvidia"
                        break
                    if "amd" in g_lower or "radeon" in g_lower:
                        name = g
                        vendor = "amd"
                        break
                if vendor == "unknown":
                    name = gpus[0]
                    name_lower = name.lower()
                    if "intel" in name_lower:
                        vendor = "intel"
                    elif "microsoft" in name_lower:
                        vendor = "microsoft"

        elif system == "Linux":
            # Try nvidia-smi first
            try:
                out = subprocess.check_output(
                    ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                if out:
                    name = out.split("\n")[0].strip()
                    vendor = "nvidia"
            except FileNotFoundError:
                pass

            # Try lspci for AMD
            if vendor == "unknown":
                try:
                    out = subprocess.check_output(
                        ["lspci"],
                        stderr=subprocess.DEVNULL
                    ).decode()
                    for line in out.splitlines():
                        ll = line.lower()
                        if "vga" in ll or "3d controller" in ll:
                            if "amd" in ll or "radeon" in ll:
                                name = line.split(":")[-1].strip()
                                vendor = "amd"
                                break
                            elif "nvidia" in ll:
                                name = line.split(":")[-1].strip()
                                vendor = "nvidia"
                                break
                            elif "intel" in ll:
                                name = line.split(":")[-1].strip()
                                vendor = "intel"
                except FileNotFoundError:
                    pass

        elif system == "Darwin":
            try:
                out = subprocess.check_output(
                    ["system_profiler", "SPDisplaysDataType"],
                    stderr=subprocess.DEVNULL
                ).decode()
                for line in out.splitlines():
                    if "Chipset Model:" in line:
                        name = line.split(":", 1)[-1].strip()
                        nl = name.lower()
                        if "amd" in nl or "radeon" in nl:
                            vendor = "amd"
                        elif "nvidia" in nl:
                            vendor = "nvidia"
                        elif "apple" in nl or "m1" in nl or "m2" in nl or "m3" in nl or "m4" in nl:
                            vendor = "apple_silicon"
                        elif "intel" in nl:
                            vendor = "intel"
                        break
            except Exception:
                pass

    except Exception:
        pass

    # Apple Silicon has a unified GPU — treat it as dedicated
    DEDICATED_VENDORS = {"nvidia", "amd", "apple_silicon"}
    has_dedicated_gpu = vendor in DEDICATED_VENDORS

    return {
        "name": name,
        "vendor": vendor,
        "has_dedicated_gpu": has_dedicated_gpu,
    }


def get_hardware_profile() -> dict:
    """
    Build the complete hardware profile used to decide engine availability.

    Returns
    -------
    dict with keys:
        ram_gb              – float, total RAM
        gpu                 – dict (name, vendor, has_dedicated_gpu)
        has_enough_ram      – bool, >= 8 GB
        deep_ai_available   – bool, machine can run Ollama + Llama 4
        recommended_mode    – 'fast' | 'deep'
        os                  – platform string
    """
    ram_gb = _get_ram_gb()
    gpu = _get_gpu_info()

    has_enough_ram = ram_gb >= 8.0
    deep_ai_available = has_enough_ram and gpu["has_dedicated_gpu"]
    recommended_mode = "deep" if deep_ai_available else "fast"

    return {
        "ram_gb": ram_gb,
        "gpu": gpu,
        "has_enough_ram": has_enough_ram,
        "deep_ai_available": deep_ai_available,
        "recommended_mode": recommended_mode,
        "os": platform.system(),
    }


if __name__ == "__main__":
    profile = get_hardware_profile()
    print(json.dumps(profile, indent=2))
