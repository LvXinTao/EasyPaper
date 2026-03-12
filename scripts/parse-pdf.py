#!/usr/bin/env python3
"""Parse a PDF file to Markdown using Marker."""
import sys
import json
import os

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: parse-pdf.py <pdf_path> <output_dir>"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
    try:
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        from marker.output import text_from_rendered
        converter = PdfConverter(artifact_dict=create_model_dict())
        rendered = converter(pdf_path)
        text, _, images = text_from_rendered(rendered)
        images_dir = os.path.join(output_dir, "images")
        os.makedirs(images_dir, exist_ok=True)
        for img_name, img_data in images.items():
            img_path = os.path.join(images_dir, img_name)
            img_data.save(img_path)
        print(text)
    except ImportError:
        print(json.dumps({"error": "marker-pdf not installed. Run: pip install marker-pdf"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
