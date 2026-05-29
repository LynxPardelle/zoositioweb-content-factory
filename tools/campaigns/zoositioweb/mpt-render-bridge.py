import argparse
import json
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Render a Zoositioweb pilot video through MoneyPrinterTurbo services."
    )
    parser.add_argument("--mpt-root", required=True)
    parser.add_argument("--source-video", required=True)
    parser.add_argument("--source-audio", required=True)
    parser.add_argument("--subtitle-file", required=True)
    parser.add_argument("--combined-file", required=True)
    parser.add_argument("--output-file", required=True)
    parser.add_argument("--font-name", default="MicrosoftYaHeiBold.ttc")
    parser.add_argument("--font-size", type=int, default=60)
    parser.add_argument("--stroke-width", type=int, default=3)
    parser.add_argument("--threads", type=int, default=2)
    return parser.parse_args()


def require_file(path_value, label):
    if not os.path.isfile(path_value):
        raise FileNotFoundError(f"{label} not found: {path_value}")


def main():
    args = parse_args()
    mpt_root = os.path.abspath(args.mpt_root)

    if not os.path.isdir(mpt_root):
        raise FileNotFoundError(f"MoneyPrinterTurbo root not found: {mpt_root}")

    require_file(args.source_video, "source video")
    require_file(args.source_audio, "source audio")
    require_file(args.subtitle_file, "subtitle file")

    os.makedirs(os.path.dirname(args.combined_file), exist_ok=True)
    os.makedirs(os.path.dirname(args.output_file), exist_ok=True)
    os.chdir(mpt_root)
    sys.path.insert(0, mpt_root)

    from app.models.schema import VideoAspect, VideoConcatMode, VideoParams
    from app.services import video

    params = VideoParams(
        video_subject="Zoositioweb pilot",
        video_script="",
        video_aspect=VideoAspect.portrait.value,
        video_concat_mode=VideoConcatMode.sequential.value,
        video_transition_mode=None,
        video_clip_duration=5,
        video_count=1,
        video_source="local",
        voice_volume=1.0,
        bgm_type="",
        bgm_volume=0,
        subtitle_enabled=True,
        subtitle_position="bottom",
        font_name=args.font_name,
        text_fore_color="#FFFFFF",
        text_background_color=False,
        font_size=args.font_size,
        stroke_color="#101010",
        stroke_width=args.stroke_width,
        n_threads=args.threads,
    )

    video.combine_videos(
        combined_video_path=args.combined_file,
        video_paths=[args.source_video],
        audio_file=args.source_audio,
        video_aspect=VideoAspect.portrait.value,
        video_concat_mode=VideoConcatMode.sequential,
        video_transition_mode=None,
        max_clip_duration=params.video_clip_duration,
        threads=args.threads,
    )
    video.generate_video(
        video_path=args.combined_file,
        audio_path=args.source_audio,
        subtitle_path=args.subtitle_file,
        output_file=args.output_file,
        params=params,
    )

    print(
        json.dumps(
            {
                "combinedFile": args.combined_file,
                "outputFile": args.output_file,
                "fontName": args.font_name,
                "fontSize": args.font_size,
                "strokeWidth": args.stroke_width,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
