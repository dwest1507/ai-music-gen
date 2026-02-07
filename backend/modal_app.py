"""
ACE-Step 1.5 Music Generation on Modal

This module deploys the ACE-Step 1.5 model on Modal with build-time model baking
for fast cold starts. The model weights are downloaded during image build.
"""
import modal
import io

# --- Constants ---
MODEL_DIR = "/models"
REPO_ID = "ACE-Step/Ace-Step1.5"

# --- Image Definition ---
# Build the container image with all dependencies and model weights baked in

def download_models():
    """Download model weights during image build (runs at build time)."""
    import os
    from huggingface_hub import snapshot_download
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Download ACE-Step 1.5 model files
    snapshot_download(
        repo_id=REPO_ID,
        local_dir=MODEL_DIR,
        local_dir_use_symlinks=False,
    )
    print(f"Model downloaded to {MODEL_DIR}")


# Define the image with dependencies
# We need to install PyTorch with CUDA from the official PyTorch index first,
# then install ACE-Step without dependencies to avoid conflicts
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    # Install PyTorch with CUDA from the official PyTorch index
    .pip_install(
        "torch==2.10.0",
        "torchaudio==2.10.0",
        "torchvision==0.25.0",
        index_url="https://download.pytorch.org/whl/cu128",
    )
    # Install ACE-Step dependencies manually
    .pip_install(
        "transformers>=4.51.0,<4.58.0",
        "diffusers",
        "accelerate>=1.12.0",
        "scipy>=1.10.1",
        "soundfile>=0.13.1",
        "einops>=0.8.1",
        "loguru>=0.7.3",
        "vector-quantize-pytorch>=1.27.15",
        "huggingface_hub",
        "gradio>=6.5.1",
        "fastapi>=0.110.0",
        "uvicorn",
        "matplotlib>=3.7.5",
        "numba>=0.63.1",
        "peft>=0.7.0",
        "diskcache",
    )
    # Install ACE-Step from GitHub without dependencies (we already installed them)
    .pip_install(
        "git+https://github.com/ACE-Step/ACE-Step-1.5.git",
        extra_options="--no-deps",
    )
    .run_function(download_models, gpu="any")
)

# --- Modal App ---
app = modal.App("music-gen-app", image=image)


@app.cls(gpu="A10G", timeout=600, scaledown_window=300)
class MusicGenerator:
    """Music generation class using ACE-Step 1.5."""
    
    @modal.enter()
    def initialize(self):
        """Load models into GPU memory when container starts."""
        import torch
        from acestep.handler import AceStepHandler
        from acestep.llm_inference import LLMHandler
        
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Initialize DiT handler
        self.dit_handler = AceStepHandler()
        
        # Initialize service with model path
        status, success = self.dit_handler.initialize_service(
            project_root=MODEL_DIR,
            config_path="acestep-v15-turbo",  # Use turbo model for faster inference
            device=self.device,
            use_flash_attention=False,  # Set to True if flash-attn is installed
            compile_model=False,
            offload_to_cpu=False,
        )
        
        if not success:
            raise RuntimeError(f"Failed to initialize DiT model: {status}")
        
        print(f"DiT model initialized: {status}")
        
        # Initialize LLM handler (optional, for enhanced generation)
        self.llm_handler = LLMHandler()
        
        # Try to initialize LLM
        try:
            lm_status, lm_success = self.llm_handler.initialize(
                checkpoint_dir=f"{MODEL_DIR}/checkpoints",
                lm_model_path="acestep-5Hz-lm-0.6B",  # Smaller LM for faster inference
                backend="pt",  # Use PyTorch backend (vllm requires additional setup)
                device=self.device,
                offload_to_cpu=False,
            )
            if lm_success:
                print(f"LLM initialized: {lm_status}")
            else:
                print(f"LLM initialization failed (will proceed without): {lm_status}")
                self.llm_handler = None
        except Exception as e:
            print(f"LLM initialization error (will proceed without): {e}")
            self.llm_handler = None
    
    @modal.method()
    def generate(self, prompt: str, duration: int = 60, genre: str = "") -> bytes:
        """
        Generate music based on the prompt.
        
        Args:
            prompt: Text description of the music to generate
            duration: Target duration in seconds (default: 60)
            genre: Optional genre hint (will be added to prompt)
            
        Returns:
            Generated audio as WAV bytes
        """
        import torch
        import soundfile as sf
        from acestep.inference import generate_music, GenerationParams, GenerationConfig
        
        # Build caption from prompt and genre
        caption = prompt
        if genre:
            caption = f"{genre} style. {prompt}"
        
        # Configure generation parameters
        params = GenerationParams(
            task_type="text2music",
            caption=caption,
            lyrics="[Instrumental]",  # Default to instrumental
            duration=float(duration),
            inference_steps=8,  # Turbo model uses fewer steps
            guidance_scale=7.0,
            seed=-1,  # Random seed
            thinking=self.llm_handler is not None and self.llm_handler.llm_initialized,
        )
        
        config = GenerationConfig(
            batch_size=1,
            use_random_seed=True,
            audio_format="wav",
        )
        
        # Generate music
        result = generate_music(
            dit_handler=self.dit_handler,
            llm_handler=self.llm_handler if self.llm_handler and self.llm_handler.llm_initialized else None,
            params=params,
            config=config,
            save_dir=None,  # We'll handle saving ourselves
        )
        
        if not result.success:
            raise RuntimeError(f"Generation failed: {result.error}")
        
        if not result.audios:
            raise RuntimeError("No audio generated")
        
        # Get the first generated audio
        audio_data = result.audios[0]
        audio_tensor = audio_data.get("tensor")
        sample_rate = audio_data.get("sample_rate", 48000)
        
        if audio_tensor is None:
            raise RuntimeError("No audio tensor in result")
        
        # Convert tensor to numpy and save to WAV bytes
        if isinstance(audio_tensor, torch.Tensor):
            audio_np = audio_tensor.cpu().numpy()
        else:
            audio_np = audio_tensor
        
        # Handle channel dimension: [channels, samples] -> [samples, channels]
        if audio_np.ndim == 2 and audio_np.shape[0] in [1, 2]:
            audio_np = audio_np.T
        
        # Write to bytes buffer as WAV
        buffer = io.BytesIO()
        sf.write(buffer, audio_np, sample_rate, format="WAV")
        buffer.seek(0)
        
        return buffer.getvalue()


# --- Local entrypoint for testing ---
@app.local_entrypoint()
def main(prompt: str = "A cheerful acoustic guitar melody", duration: int = 30):
    """Test the music generation locally."""
    generator = MusicGenerator()
    
    print(f"Generating music for: '{prompt}'")
    audio_bytes = generator.generate.remote(prompt=prompt, duration=duration)
    
    # Save to file
    output_path = "generated_music.wav"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    print(f"Audio saved to {output_path}")
